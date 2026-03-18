import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateFirstQuestion, generateNextQuestion } from "@/lib/ai/question";
import { buildCustomerContext, buildInterviewSettings } from "@/lib/ai/context";
import type { ExtractionState, Message } from "@/lib/supabase/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .select("*")
    .eq("share_token", token)
    .single();

  if (interviewError || !interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  if (interview.status !== "draft" && interview.status !== "in_progress") {
    return NextResponse.json({ error: "Interview already completed" }, { status: 400 });
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("interview_id", interview.id)
    .order("created_at", { ascending: true });

  const extractionState = interview.extraction_state as ExtractionState;
  const customerContext = buildCustomerContext(
    interview.linkedin_profile_url,
    interview.company_website_url
  );
  const interviewSettings = buildInterviewSettings(
    interview.interview_tone,
    interview.interview_focus,
    interview.target_audience
  );
  const questionLimit = interview.question_limit ?? 15;
  let questionResponse;

  try {
    if (!messages || messages.length === 0) {
      questionResponse = await generateFirstQuestion(
        interview.product_name,
        interview.customer_company,
        customerContext,
        interviewSettings
      );

      await supabase
        .from("interviews")
        .update({ status: "in_progress" })
        .eq("id", interview.id);
    } else {
      questionResponse = await generateNextQuestion(
        interview.product_name,
        interview.customer_company,
        messages as Message[],
        extractionState,
        customerContext,
        questionLimit,
        interviewSettings
      );
    }
  } catch (err) {
    console.error("AI question generation failed:", err);
    return NextResponse.json({ error: "Failed to generate question" }, { status: 502 });
  }

  await supabase.from("messages").insert({
    interview_id: interview.id,
    role: "assistant",
    content: questionResponse.question,
  });

  return NextResponse.json({
    question: questionResponse.question,
    type: questionResponse.type,
    should_end: questionResponse.should_end,
    question_count: extractionState.question_count + 1,
  });
}
