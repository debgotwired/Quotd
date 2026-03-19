import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { buildReminderPrompt } from "./prompt";
import type { ExtractionState } from "@/lib/supabase/types";

const ReminderContentSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type ReminderContent = z.infer<typeof ReminderContentSchema>;

export async function generateReminderContent(
  company: string,
  product: string,
  extractionState: ExtractionState,
  tier: number
): Promise<ReminderContent> {
  const facts = JSON.stringify(
    {
      challenge: extractionState.facts?.challenge,
      solution: extractionState.facts?.solution,
      impact: extractionState.facts?.impact,
      metricCount: extractionState.metrics?.length ?? 0,
      quoteCount: extractionState.quotes?.length ?? 0,
    },
    null,
    2
  );

  const prompt = buildReminderPrompt(company, product, facts, tier);

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: ReminderContentSchema,
    prompt,
    abortSignal: AbortSignal.timeout(15000),
  });

  return object;
}
