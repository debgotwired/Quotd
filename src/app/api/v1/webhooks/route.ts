import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events";
import crypto from "crypto";

export const GET = withApiAuth(async (req, { userId }) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10) || 20));
  const offset = (page - 1) * perPage;

  const supabase = await createServiceClient();

  const { data, count, error } = await supabase
    .from("webhooks")
    .select("id, url, events, active, created_at, updated_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
  }

  return NextResponse.json({
    data: data || [],
    pagination: {
      page,
      per_page: perPage,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / perPage),
    },
  });
});

export const POST = withApiAuth(async (req, { userId }) => {
  let body: { url: string; events: string[]; secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const parsed = new URL(body.url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
  }

  const validEvents = WEBHOOK_EVENTS as readonly string[];
  const invalidEvents = body.events.filter((e) => !validEvents.includes(e));
  if (invalidEvents.length > 0) {
    return NextResponse.json(
      { error: `Invalid events: ${invalidEvents.join(", ")}. Valid events: ${validEvents.join(", ")}` },
      { status: 400 }
    );
  }

  const secret = body.secret || crypto.randomBytes(32).toString("hex");

  const supabase = await createServiceClient();

  const { data: webhook, error } = await supabase
    .from("webhooks")
    .insert({
      user_id: userId,
      url: body.url,
      events: body.events,
      secret,
      active: true,
    })
    .select("id, url, events, secret, active, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }

  return NextResponse.json({ data: webhook }, { status: 201 });
});
