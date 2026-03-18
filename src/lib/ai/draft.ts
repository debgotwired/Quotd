import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { DRAFT_GENERATOR_PROMPT } from "./prompts";
import type { ExtractionState, Message } from "@/lib/supabase/types";

export async function generateDraft(
  company: string,
  product: string,
  extractionState: ExtractionState,
  messages: Message[]
): Promise<string> {
  const transcript = messages
    .map((m) => `${m.role === "assistant" ? "Interviewer" : "Customer"}: ${m.content}`)
    .join("\n\n");

  const prompt = DRAFT_GENERATOR_PROMPT
    .replace("{{company}}", company)
    .replace("{{product}}", product)
    .replace("{{extraction}}", JSON.stringify(extractionState, null, 2))
    .replace("{{transcript}}", transcript);

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    prompt,
    abortSignal: AbortSignal.timeout(45000),
  });

  return text;
}
