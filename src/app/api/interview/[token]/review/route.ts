import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { ReviewState } from "@/lib/supabase/types";
import { isInterviewDone } from "@/lib/review/helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("id, status, draft_content, customer_draft_content, review_state, product_name, customer_company")
    .eq("share_token", token)
    .single();

  if (error || !interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  if (!isInterviewDone(interview.status)) {
    return NextResponse.json({ error: "Interview not ready for review" }, { status: 400 });
  }

  return NextResponse.json({
    draft_content: interview.draft_content,
    customer_draft_content: interview.customer_draft_content,
    review_state: interview.review_state,
    product_name: interview.product_name,
    customer_company: interview.customer_company,
    status: interview.status,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { review_state } = await request.json();

  if (!review_state || !Array.isArray(review_state.sections)) {
    return NextResponse.json({ error: "Invalid review state" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("id, status, review_state")
    .eq("share_token", token)
    .single();

  if (error || !interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  if (interview.status !== "review_pending" && interview.status !== "review_in_progress") {
    return NextResponse.json({ error: "Review not available" }, { status: 400 });
  }

  // Transition review_pending → review_in_progress on first save
  const updates: Record<string, unknown> = {
    review_state: {
      ...review_state,
      started_at: (interview.review_state as ReviewState | null)?.started_at || new Date().toISOString(),
      completed_at: null,
    },
  };

  if (interview.status === "review_pending") {
    updates.status = "review_in_progress";
  }

  const { error: updateError } = await supabase
    .from("interviews")
    .update(updates)
    .eq("id", interview.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
