import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { EXTRACTION_PROMPT } from "./prompts";
import type { ExtractionState, Metric } from "@/lib/supabase/types";

const MetricSchema = z.object({
  name: z.string(),
  baseline: z.string().nullable(),
  after: z.string().nullable(),
  delta: z.string().nullable(),
  unit: z.string(),
  timeframe: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
});

const ExtractionResultSchema = z.object({
  metrics: z.array(MetricSchema),
  quotes: z.array(z.object({ text: z.string(), tag: z.string() })),
  facts: z.object({
    challenge: z.string().optional(),
    solution: z.string().optional(),
    impact: z.string().optional(),
  }),
});

export async function extractFromAnswer(
  currentState: ExtractionState,
  question: string,
  answer: string
): Promise<ExtractionState> {
  const prompt = EXTRACTION_PROMPT
    .replace("{{state}}", JSON.stringify(currentState, null, 2))
    .replace("{{question}}", question)
    .replace("{{answer}}", answer);

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: ExtractionResultSchema,
    prompt,
  });

  const mergedMetrics = mergeMetrics(currentState.metrics, object.metrics);
  const mergedQuotes = [...currentState.quotes, ...object.quotes];
  const mergedFacts = {
    challenge: object.facts.challenge || currentState.facts?.challenge,
    solution: object.facts.solution || currentState.facts?.solution,
    impact: object.facts.impact || currentState.facts?.impact,
  };

  return {
    metrics: mergedMetrics,
    quotes: mergedQuotes,
    facts: mergedFacts,
    question_count: currentState.question_count + 1,
  };
}

function mergeMetrics(existing: Metric[], newMetrics: Metric[]): Metric[] {
  const metricMap = new Map<string, Metric>();
  for (const metric of existing) {
    metricMap.set(metric.name.toLowerCase(), metric);
  }
  for (const metric of newMetrics) {
    const key = metric.name.toLowerCase();
    const existingMetric = metricMap.get(key);
    if (existingMetric) {
      metricMap.set(key, {
        name: metric.name,
        baseline: metric.baseline || existingMetric.baseline,
        after: metric.after || existingMetric.after,
        delta: metric.delta || existingMetric.delta,
        unit: metric.unit || existingMetric.unit,
        timeframe: metric.timeframe || existingMetric.timeframe,
        confidence: metric.confidence,
      });
    } else {
      metricMap.set(key, metric);
    }
  }
  return Array.from(metricMap.values());
}

export function getMissingFields(state: ExtractionState): string[] {
  const missing: string[] = [];
  if (!state.facts?.challenge) missing.push("challenge/problem before using the product");
  if (!state.facts?.solution) missing.push("how they use the product/solution");
  if (!state.facts?.impact) missing.push("overall business impact");
  if (state.metrics.length === 0) missing.push("specific metrics or numbers");
  if (state.quotes.length < 2) missing.push("quotable statements");
  for (const metric of state.metrics) {
    if (!metric.after && !metric.delta) {
      missing.push(`result/outcome for "${metric.name}"`);
    }
  }
  return missing;
}
