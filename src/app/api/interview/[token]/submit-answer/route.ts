import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractFromAnswer } from "@/lib/ai/extract";
import { generateNextQuestion } from "@/lib/ai/question";
import { generateDraft } from "@/lib/ai/draft";
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
  const newState = await extractFromAnswer(currentState, lastQuestion.content, answer);

  await supabase
    .from("interviews")
    .update({ extraction_state: newState })
    .eq("id", interview.id);

  const { data: updatedMessages } = await supabase
    .from("messages")
    .select("*")
    .eq("interview_id", interview.id)
    .order("created_at", { ascending: true });

  const questionResponse = await generateNextQuestion(
    interview.product_name,
    interview.customer_company,
    (updatedMessages || []) as Message[],
    newState
  );

  if (questionResponse.should_end) {
    await supabase.from("messages").insert({
      interview_id: interview.id,
      role: "assistant",
      content: questionResponse.question,
    });

    const draft = await generateDraft(
      interview.customer_company,
      interview.product_name,
      newState,
      (updatedMessages || []) as Message[]
    );

    await supabase
      .from("interviews")
      .update({
        status: "completed",
        extraction_state: newState,
        draft_content: draft,
      })
      .eq("id", interview.id);

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
