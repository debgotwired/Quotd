import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createServiceClient } from "@/lib/supabase/server";

export const GET = withApiAuth(async (_req, { userId }) => {
  const supabase = await createServiceClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, company_name, logo_url, primary_color, welcome_message, created_at, updated_at")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ data: profile });
});
