import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createServiceClient } from "@/lib/supabase/server";

export const GET = withApiAuth(async (_req, { userId }) => {
  const supabase = await createServiceClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("logo_url, primary_color, welcome_message, company_name")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ data: profile });
});

export const PATCH = withApiAuth(async (req, { userId }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};

  if (typeof body.primary_color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.primary_color)) {
    updates.primary_color = body.primary_color;
  }

  if (body.welcome_message !== undefined) {
    updates.welcome_message =
      typeof body.welcome_message === "string" && body.welcome_message.trim()
        ? body.welcome_message.trim().slice(0, 500)
        : null;
  }

  if (body.logo_url !== undefined) {
    if (typeof body.logo_url === "string" && body.logo_url.trim()) {
      try {
        const parsed = new URL(body.logo_url.trim());
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return NextResponse.json({ error: "Invalid logo URL scheme" }, { status: 400 });
        }
        updates.logo_url = parsed.href;
      } catch {
        return NextResponse.json({ error: "Invalid logo URL" }, { status: 400 });
      }
    } else {
      updates.logo_url = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: "Failed to update branding" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
