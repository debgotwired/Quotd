import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { isInterviewDone } from "@/lib/review/helpers";
import { getBrandingForInterview } from "@/lib/branding/get-branding";
import { CustomerReview } from "@/components/review/customer-review";
import type { ReviewState } from "@/lib/supabase/types";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("share_token", token)
    .single();

  if (error || !interview) {
    notFound();
  }

  if (!isInterviewDone(interview.status)) {
    notFound();
  }

  const reviewState = interview.review_state as ReviewState | null;

  if (!reviewState) {
    notFound();
  }

  const branding = await getBrandingForInterview(supabase, interview.user_id, interview.client_id);

  return (
    <CustomerReview
      token={token}
      productName={interview.product_name}
      customerCompany={interview.customer_company}
      draftContent={interview.draft_content || ""}
      customerDraftContent={interview.customer_draft_content || null}
      initialReviewState={reviewState}
      status={interview.status}
      branding={branding}
    />
  );
}
