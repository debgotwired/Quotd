import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("logo_url, primary_color, welcome_message")
    .eq("user_id", user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, string | null> = {};

  if (typeof body.primary_color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.primary_color)) {
    updates.primary_color = body.primary_color;
  }

  if (body.welcome_message !== undefined) {
    updates.welcome_message = typeof body.welcome_message === "string" && body.welcome_message.trim()
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

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update branding" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
