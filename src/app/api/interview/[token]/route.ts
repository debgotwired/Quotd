import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getBrandingForInterview } from "@/lib/branding/get-branding";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("share_token", token)
    .single();

  if (error || !interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const [{ data: messages }, branding] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("interview_id", interview.id)
      .order("created_at", { ascending: true }),
    getBrandingForInterview(supabase, interview.user_id, interview.client_id),
  ]);

  return NextResponse.json({
    interview: {
      id: interview.id,
      customer_company: interview.customer_company,
      product_name: interview.product_name,
      category: interview.category,
      status: interview.status,
      extraction_state: interview.extraction_state,
      review_state: interview.review_state || null,
      customer_draft_content: interview.customer_draft_content || null,
      draft_content: interview.draft_content || null,
      question_limit: interview.question_limit ?? 15,
    },
    branding,
    messages: messages || [],
  });
}
