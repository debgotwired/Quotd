import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events";

export const GET = withApiAuth(async (_req, { userId, params }) => {
  const { webhookId } = params;
  const supabase = await createServiceClient();

  const { data: webhook } = await supabase
    .from("webhooks")
    .select("id, url, events, secret, active, created_at, updated_at")
    .eq("id", webhookId)
    .eq("user_id", userId)
    .single();

  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  return NextResponse.json({ data: webhook });
});

export const PATCH = withApiAuth(async (req, { userId, params }) => {
  const { webhookId } = params;

  let body: { url?: string; events?: string[]; active?: boolean; secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("webhooks")
    .select("id")
    .eq("id", webhookId)
    .eq("user_id", userId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (body.url !== undefined) {
    try {
      const parsed = new URL(body.url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
      }
      updates.url = body.url;
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  }

  if (body.events !== undefined) {
    if (!Array.isArray(body.events) || body.events.length === 0) {
      return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
    }
    const validEvents = WEBHOOK_EVENTS as readonly string[];
    const invalidEvents = body.events.filter((e) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid events: ${invalidEvents.join(", ")}` },
        { status: 400 }
      );
    }
    updates.events = body.events;
  }

  if (body.active !== undefined) {
    updates.active = Boolean(body.active);
  }

  if (body.secret !== undefined) {
    updates.secret = body.secret;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data: webhook, error } = await supabase
    .from("webhooks")
    .update(updates)
    .eq("id", webhookId)
    .select("id, url, events, secret, active, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }

  return NextResponse.json({ data: webhook });
});

export const DELETE = withApiAuth(async (_req, { userId, params }) => {
  const { webhookId } = params;
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", webhookId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
