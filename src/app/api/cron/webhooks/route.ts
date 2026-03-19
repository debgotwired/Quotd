import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { signPayload } from "@/lib/webhooks/sign";

// Backoff: attempt 2 = +5min, attempt 3 = +30min
const BACKOFF_MS: Record<number, number> = {
  2: 5 * 60 * 1000,
  3: 30 * 60 * 1000,
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Find failed deliveries that are due for retry (max 3 attempts)
  const { data: pendingRetries, error } = await supabase
    .from("webhook_deliveries")
    .select("id, webhook_id, event, payload, attempt")
    .is("delivered_at", null)
    .lt("attempt", 4)
    .lte("next_retry_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(50);

  if (error || !pendingRetries) {
    return NextResponse.json(
      { error: "Failed to fetch pending retries" },
      { status: 500 }
    );
  }

  const results: { id: string; status: string }[] = [];

  for (const delivery of pendingRetries) {
    try {
      // Fetch the webhook config
      const { data: webhook } = await supabase
        .from("webhooks")
        .select("id, url, secret, active")
        .eq("id", delivery.webhook_id)
        .single();

      if (!webhook || !webhook.active) {
        results.push({ id: delivery.id, status: "skipped_inactive" });
        continue;
      }

      const body = JSON.stringify({
        event: delivery.event,
        data: delivery.payload,
        timestamp: new Date().toISOString(),
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Quotd-Event": delivery.event,
        "X-Quotd-Delivery": delivery.id,
      };
      if (webhook.secret) {
        headers["X-Quotd-Signature"] = signPayload(body, webhook.secret);
      }

      const res = await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      });

      const newAttempt = delivery.attempt + 1;

      if (res.ok) {
        await supabase
          .from("webhook_deliveries")
          .update({
            status_code: res.status,
            response_body: (await res.text()).slice(0, 1000),
            delivered_at: new Date().toISOString(),
            attempt: newAttempt,
            next_retry_at: null,
          })
          .eq("id", delivery.id);
        results.push({ id: delivery.id, status: "delivered" });
      } else {
        const backoff = BACKOFF_MS[newAttempt] || null;
        await supabase
          .from("webhook_deliveries")
          .update({
            status_code: res.status,
            response_body: (await res.text()).slice(0, 1000),
            attempt: newAttempt,
            next_retry_at: backoff
              ? new Date(Date.now() + backoff).toISOString()
              : null,
          })
          .eq("id", delivery.id);
        results.push({
          id: delivery.id,
          status: newAttempt >= 4 ? "max_retries" : "retry_scheduled",
        });
      }
    } catch (err) {
      const newAttempt = delivery.attempt + 1;
      const backoff = BACKOFF_MS[newAttempt] || null;
      await supabase
        .from("webhook_deliveries")
        .update({
          response_body: String(err),
          attempt: newAttempt,
          next_retry_at: backoff
            ? new Date(Date.now() + backoff).toISOString()
            : null,
        })
        .eq("id", delivery.id);
      results.push({ id: delivery.id, status: "error" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
