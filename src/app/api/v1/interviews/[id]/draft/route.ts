import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createServiceClient } from "@/lib/supabase/server";

export const GET = withApiAuth(async (_req, { userId, params }) => {
  const { id } = params;
  const supabase = await createServiceClient();

  const { data: interview } = await supabase
    .from("interviews")
    .select("id, draft_content, customer_draft_content")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  if (!interview.draft_content) {
    return NextResponse.json({ error: "No draft content available" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      draft_content: interview.draft_content,
      customer_draft_content: interview.customer_draft_content || null,
    },
  });
});

export const PUT = withApiAuth(async (req, { userId, params }) => {
  const { id } = params;

  let body: { content: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "Content must be a string" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: interview } = await supabase
    .from("interviews")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("interviews")
    .update({ draft_content: body.content })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
