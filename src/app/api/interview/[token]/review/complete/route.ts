import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cancelReminders } from "@/lib/reminders/init";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
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

  const currentReviewState = (interview.review_state as ReviewState | null) ?? {};

  const { error: updateError } = await supabase
    .from("interviews")
    .update({
      status: "review_complete",
      review_state: {
        ...currentReviewState,
        completed_at: new Date().toISOString(),
      },
      review_completed_at: new Date().toISOString(),
    })
    .eq("id", interview.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }

  // Dispatch review.completed webhook (fire and forget)
  dispatchWebhookEvent(interview.user_id, "review.completed", {
    interview_id: interview.id,
    customer_company: interview.customer_company,
    product_name: interview.product_name,
  }).catch(console.error);

  // Cancel any pending follow-up reminders
  cancelReminders(interview.id).catch((err) => {
    console.error("Failed to cancel reminders:", err);
  });

  return NextResponse.json({ success: true });
}
