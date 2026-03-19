import { createServiceClient } from "@/lib/supabase/server";
import { signPayload } from "./sign";

export async function dispatchWebhookEvent(
  userId: string,
  event: string,
  payload: object
): Promise<void> {
  const supabase = await createServiceClient();

  const { data: webhooks } = await supabase
    .from("webhooks")
    .select("id, url, secret, events")
    .eq("user_id", userId)
    .eq("active", true);

  if (!webhooks?.length) return;

  const matching = webhooks.filter((w) =>
    (w.events as string[]).includes(event)
  );

  for (const webhook of matching) {
    const body = JSON.stringify({
      event,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    const { data: delivery } = await supabase
      .from("webhook_deliveries")
      .insert({
        webhook_id: webhook.id,
        event,
        payload,
      })
      .select("id")
      .single();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Quotd-Event": event,
      };
      if (delivery) headers["X-Quotd-Delivery"] = delivery.id;
      if (webhook.secret)
        headers["X-Quotd-Signature"] = signPayload(body, webhook.secret);

      const res = await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      });

      if (delivery) {
        await supabase
          .from("webhook_deliveries")
          .update({
            status_code: res.status,
            response_body: (await res.text()).slice(0, 1000),
            delivered_at: res.ok ? new Date().toISOString() : null,
            next_retry_at: res.ok
              ? null
              : new Date(Date.now() + 60000).toISOString(),
          })
          .eq("id", delivery.id);
      }
    } catch (err) {
      if (delivery) {
        await supabase
          .from("webhook_deliveries")
          .update({
            response_body: String(err),
            next_retry_at: new Date(Date.now() + 60000).toISOString(),
          })
          .eq("id", delivery.id);
      }
    }
  }
}
