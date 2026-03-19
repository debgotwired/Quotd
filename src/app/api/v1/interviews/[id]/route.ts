import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createServiceClient } from "@/lib/supabase/server";

export const GET = withApiAuth(async (_req, { userId, params }) => {
  const { id } = params;
  const supabase = await createServiceClient();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  return NextResponse.json({ data: interview });
});

export const PATCH = withApiAuth(async (req, { userId, params }) => {
  const { id } = params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Verify ownership
  const { data: interview } = await supabase
    .from("interviews")
    .select("id, user_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const allowedFields = [
    "customer_company",
    "product_name",
    "customer_email",
    "interview_tone",
    "interview_focus",
    "target_audience",
    "question_limit",
    "linkedin_profile_url",
    "company_website_url",
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("interviews")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Failed to update interview" }, { status: 500 });
  }

  return NextResponse.json({ data: updated });
});

export const DELETE = withApiAuth(async (_req, { userId, params }) => {
  const { id } = params;
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("interviews")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete interview" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
