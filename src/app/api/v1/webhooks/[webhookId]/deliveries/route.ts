import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createServiceClient } from "@/lib/supabase/server";

export const GET = withApiAuth(async (_req, { userId, params }) => {
  const { webhookId } = params;
  const supabase = await createServiceClient();

  // Verify webhook ownership
  const { data: webhook } = await supabase
    .from("webhooks")
    .select("id")
    .eq("id", webhookId)
    .eq("user_id", userId)
    .single();

  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const { data: deliveries, error } = await supabase
    .from("webhook_deliveries")
    .select("id, event, payload, status_code, response_body, attempt, delivered_at, created_at")
    .eq("webhook_id", webhookId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch deliveries" }, { status: 500 });
  }

  return NextResponse.json({ data: deliveries || [] });
});
