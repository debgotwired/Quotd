import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signPayload } from "@/lib/webhooks/sign";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { webhook_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.webhook_id) {
    return NextResponse.json({ error: "webhook_id is required" }, { status: 400 });
  }

  // Fetch webhook
  const { data: webhook } = await supabase
    .from("webhooks")
    .select("id, url, secret")
    .eq("id", body.webhook_id)
    .eq("user_id", user.id)
    .single();

  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const testPayload = JSON.stringify({
    event: "test",
    data: {
      message: "This is a test webhook delivery from Quotd",
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });

  // Record the delivery attempt
  const { data: delivery } = await supabase
    .from("webhook_deliveries")
    .insert({
      webhook_id: webhook.id,
      event: "test",
      payload: JSON.parse(testPayload),
    })
    .select("id")
    .single();

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Quotd-Event": "test",
    };
    if (delivery) headers["X-Quotd-Delivery"] = delivery.id;
    if (webhook.secret) {
      headers["X-Quotd-Signature"] = signPayload(testPayload, webhook.secret);
    }

    const res = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: testPayload,
      signal: AbortSignal.timeout(10000),
    });

    const responseBody = (await res.text()).slice(0, 1000);

    if (delivery) {
      await supabase
        .from("webhook_deliveries")
        .update({
          status_code: res.status,
          response_body: responseBody,
          delivered_at: res.ok ? new Date().toISOString() : null,
        })
        .eq("id", delivery.id);
    }

    return NextResponse.json({
      success: res.ok,
      status_code: res.status,
      response_body: responseBody,
    });
  } catch (err) {
    if (delivery) {
      await supabase
        .from("webhook_deliveries")
        .update({ response_body: String(err) })
        .eq("id", delivery.id);
    }

    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 502 }
    );
  }
}
