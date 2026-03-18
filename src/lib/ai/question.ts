import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { QUESTION_GENERATOR_PROMPT, FIRST_QUESTION_PROMPT } from "./prompts";
import type { ExtractionState, Message } from "@/lib/supabase/types";

const QuestionResponseSchema = z.object({
  question: z.string(),
  type: z.enum(["context", "solution", "metrics", "quote", "wrap_up"]),
  should_end: z.boolean(),
});

export type QuestionResponse = z.infer<typeof QuestionResponseSchema>;

export async function generateFirstQuestion(
  product: string,
  company: string
): Promise<QuestionResponse> {
  const prompt = FIRST_QUESTION_PROMPT
    .replace("{{product}}", product)
    .replace("{{company}}", company);

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: QuestionResponseSchema,
    prompt,
    abortSignal: AbortSignal.timeout(30000),
  });

  return object;
}

export async function generateNextQuestion(
  product: string,
  company: string,
  messages: Message[],
  extractionState: ExtractionState
): Promise<QuestionResponse> {
  const questionCount = extractionState.question_count;
  const hasEnoughData =
    extractionState.metrics.length >= 3 &&
    extractionState.quotes.length >= 2 &&
    extractionState.facts?.challenge &&
    extractionState.facts?.impact;

  if (questionCount >= 15 || (questionCount >= 13 && hasEnoughData)) {
    return {
      question: `Thank you so much for sharing! Is there anything else you'd like to add about your results with ${product}?`,
      type: "wrap_up",
      should_end: true,
    };
  }

  const conversation = messages
    .map((m) => `${m.role === "assistant" ? "Interviewer" : "Customer"}: ${m.content}`)
    .join("\n\n");

  const prompt = QUESTION_GENERATOR_PROMPT
    .replace("{{product}}", product)
    .replace("{{company}}", company)
    .replace("{{conversation}}", conversation || "No messages yet")
    .replace("{{extraction}}", JSON.stringify(extractionState, null, 2))
    .replace("{{question_count}}", String(questionCount));

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: QuestionResponseSchema,
    prompt,
    abortSignal: AbortSignal.timeout(30000),
  });

  return object;
}
