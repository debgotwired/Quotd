import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { ReviewState } from "@/lib/supabase/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("id, status, review_state, user_id, customer_company, product_name")
    .eq("share_token", token)
    .single();

  if (error || !interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  if (interview.status !== "review_pending" && interview.status !== "review_in_progress") {
    return NextResponse.json({ error: "Review not available" }, { status: 400 });
  }

  const currentReviewState = interview.review_state as ReviewState | null;

  const { error: updateError } = await supabase
    .from("interviews")
    .update({
      status: "review_complete",
      review_state: {
        ...currentReviewState,
        completed_at: new Date().toISOString(),
      },
    })
    .eq("id", interview.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
