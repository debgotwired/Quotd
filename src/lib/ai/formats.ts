import { anthropic } from "@ai-sdk/anthropic";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import {
  FORMAT_ONE_PAGER_PROMPT,
  FORMAT_LINKEDIN_PROMPT,
  FORMAT_TWITTER_PROMPT,
  FORMAT_SALES_SLIDE_PROMPT,
  FORMAT_QUOTE_CARDS_PROMPT,
  FORMAT_EMAIL_BLURB_PROMPT,
} from "./prompts";
import type { FormatKey, ExtractionState } from "@/lib/supabase/types";

const PROMPT_MAP: Record<FormatKey, string> = {
  one_pager: FORMAT_ONE_PAGER_PROMPT,
  linkedin: FORMAT_LINKEDIN_PROMPT,
  twitter: FORMAT_TWITTER_PROMPT,
  sales_slide: FORMAT_SALES_SLIDE_PROMPT,
  quote_cards: FORMAT_QUOTE_CARDS_PROMPT,
  email_blurb: FORMAT_EMAIL_BLURB_PROMPT,
};

const QuoteCardSchema = z.object({
  quotes: z.array(
    z.object({
      text: z.string(),
      tag: z.enum(["impact", "challenge", "praise", "outcome", "transformation"]),
    })
  ),
});

function buildPrompt(
  template: string,
  company: string,
  product: string,
  extractionState: ExtractionState,
  draftContent: string
): string {
  return template
    .replace("{{company}}", company)
    .replace("{{product}}", product)
    .replace("{{extraction}}", JSON.stringify(extractionState, null, 2))
    .replace("{{draft}}", draftContent);
}

export async function generateFormat(
  key: FormatKey,
  company: string,
  product: string,
  extractionState: ExtractionState,
  draftContent: string
): Promise<string> {
  const template = PROMPT_MAP[key];
  const prompt = buildPrompt(template, company, product, extractionState, draftContent);

  if (key === "quote_cards") {
    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-20250514"),
      schema: QuoteCardSchema,
      prompt,
      abortSignal: AbortSignal.timeout(30000),
    });
    return JSON.stringify(object.quotes);
  }

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    prompt,
    abortSignal: AbortSignal.timeout(30000),
  });

  // Twitter: enforce 280 char limit
  if (key === "twitter" && text.length > 280) {
    const truncated = text.slice(0, 277);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > 200 ? truncated.slice(0, lastSpace) : truncated) + "...";
  }

  return text;
}
