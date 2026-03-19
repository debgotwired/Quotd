import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractFromAnswer } from "@/lib/ai/extract";
import { generateNextQuestion } from "@/lib/ai/question";
import { generateDraft } from "@/lib/ai/draft";
import { buildCustomerContext, buildInterviewSettings } from "@/lib/ai/context";
import { getBrandingForInterview } from "@/lib/branding/get-branding";
import { sendInterviewCompletedEmail, sendReviewReadyEmail } from "@/lib/email/send";
import { splitMarkdownIntoSections } from "@/lib/review/sections";
import { initReviewState } from "@/lib/review/helpers";
import { initReminders } from "@/lib/reminders/init";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
import type { ExtractionState, Message } from "@/lib/supabase/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { answer, audioUrl, audioPath } = await request.json();

  if (!answer || typeof answer !== "string") {
    return NextResponse.json({ error: "Answer is required" }, { status: 400 });
  }

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

  const lastQuestion = messages?.filter((m) => m.role === "assistant").pop();

  if (!lastQuestion) {
    return NextResponse.json({ error: "No question to answer" }, { status: 400 });
  }

  await supabase.from("messages").insert({
    interview_id: interview.id,
    role: "user",
    content: answer,
    audio_url: audioUrl || null,
    audio_path: audioPath || null,
  });

  const currentState = interview.extraction_state as ExtractionState;
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

  let newState: ExtractionState;
  try {
    newState = await extractFromAnswer(currentState, lastQuestion.content, answer);
  } catch (err) {
    console.error("AI extraction failed:", err);
    return NextResponse.json({ error: "Failed to process answer" }, { status: 502 });
  }

  await supabase
    .from("interviews")
    .update({ extraction_state: newState })
    .eq("id", interview.id);

  const { data: updatedMessages } = await supabase
    .from("messages")
    .select("*")
    .eq("interview_id", interview.id)
    .order("created_at", { ascending: true });

  let questionResponse;
  try {
    questionResponse = await generateNextQuestion(
      interview.product_name,
      interview.customer_company,
      (updatedMessages || []) as Message[],
      newState,
      customerContext,
      questionLimit,
      interviewSettings
    );
  } catch (err) {
    console.error("AI question generation failed:", err);
    return NextResponse.json({ error: "Failed to generate question" }, { status: 502 });
  }

  if (questionResponse.should_end) {
    await supabase.from("messages").insert({
      interview_id: interview.id,
      role: "assistant",
      content: questionResponse.question,
    });

    let draft: string;
    try {
      draft = await generateDraft(
        interview.customer_company,
        interview.product_name,
        newState,
        (updatedMessages || []) as Message[],
        customerContext,
        interviewSettings
      );
    } catch (err) {
      console.error("AI draft generation failed:", err);
      draft = "";
    }

    // Build initial review state from draft H2 headings
    const sections = splitMarkdownIntoSections(draft);
    const headings = sections.map((s) => s.heading);
    const reviewState = initReviewState(headings);

    await supabase
      .from("interviews")
      .update({
        status: "review_pending",
        extraction_state: newState,
        draft_content: draft,
        review_state: reviewState,
        completed_at: new Date().toISOString(),
      })
      .eq("id", interview.id);

    // Dispatch webhook events (fire and forget)
    dispatchWebhookEvent(interview.user_id, "interview.completed", {
      interview_id: interview.id,
      customer_company: interview.customer_company,
      product_name: interview.product_name,
    }).catch(console.error);

    if (draft) {
      dispatchWebhookEvent(interview.user_id, "draft.generated", {
        interview_id: interview.id,
        customer_company: interview.customer_company,
        product_name: interview.product_name,
      }).catch(console.error);
    }

    // Fetch branding for emails
    const branding = await getBrandingForInterview(supabase, interview.user_id, interview.client_id);

    // Send completion notification to interview owner
    if (interview.user_id) {
      const { data: userData } = await supabase.auth.admin.getUserById(
        interview.user_id
      );
      if (userData?.user?.email) {
        sendInterviewCompletedEmail(
          userData.user.email,
          interview.customer_company,
          interview.product_name,
          interview.id,
          branding.primary_color,
          branding.logo_url
        ).catch((err) => {
          console.error("Failed to send completion email:", err);
        });
      }
    }

    // Send review-ready email to customer if email was provided
    if (interview.customer_email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const reviewUrl = `${appUrl}/i/${token}/review`;
      sendReviewReadyEmail(
        interview.customer_email,
        interview.customer_company,
        interview.product_name,
        reviewUrl,
        branding.primary_color,
        branding.logo_url
      ).catch((err) => {
        console.error("Failed to send review-ready email:", err);
      });

      // Schedule adaptive follow-up reminders
      initReminders(interview.id, interview.customer_email).catch((err) => {
        console.error("Failed to init reminders:", err);
      });
    }

    return NextResponse.json({
      question: questionResponse.question,
      type: questionResponse.type,
      should_end: true,
      extraction: newState,
    });
  }

  await supabase.from("messages").insert({
    interview_id: interview.id,
    role: "assistant",
    content: questionResponse.question,
  });

  return NextResponse.json({
    question: questionResponse.question,
    type: questionResponse.type,
    should_end: false,
    extraction: newState,
  });
}
