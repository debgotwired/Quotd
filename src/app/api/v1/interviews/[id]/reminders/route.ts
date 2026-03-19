import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createServiceClient } from "@/lib/supabase/server";

export const GET = withApiAuth(async (_req, { userId, params }) => {
  const { id } = params;
  const supabase = await createServiceClient();

  // Verify ownership
  const { data: interview } = await supabase
    .from("interviews")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("id, tier, status, scheduled_for, sent_at, created_at")
    .eq("interview_id", id)
    .order("scheduled_for", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }

  return NextResponse.json({ data: reminders || [] });
});
