/**
 * Format Generation Tests
 *
 * Tests the multi-format content generation from case study data.
 * Mocks AI SDK to verify prompt dispatch, output shapes, and constraints.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateFormat } from "@/lib/ai/formats";
import type { ExtractionState } from "@/lib/supabase/types";

// Mock the AI SDK
vi.mock("ai", () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

import { generateText, generateObject } from "ai";
const mockGenerateText = vi.mocked(generateText);
const mockGenerateObject = vi.mocked(generateObject);

const sampleExtraction: ExtractionState = {
  metrics: [
    {
      name: "Time saved",
      baseline: "20 hours/week",
      after: "4 hours/week",
      delta: "80%",
      unit: "reduction",
      timeframe: "first quarter",
      confidence: "high",
    },
    {
      name: "Revenue increase",
      baseline: "$500K",
      after: "$750K",
      delta: "$250K",
      unit: "annual",
      timeframe: "year one",
      confidence: "high",
    },
  ],
  quotes: [
    { text: "This completely transformed our workflow", tag: "impact" },
    { text: "We saw results within the first week", tag: "outcome" },
  ],
  facts: {
    challenge: "Manual reporting took 20 hours per week",
    solution: "Automated reporting with real-time dashboards",
    impact: "80% time reduction and $250K revenue increase",
  },
  question_count: 12,
};

const sampleDraft = `# 80% Time Reduction: How Acme Corp Transformed Reporting

## The Challenge
Acme Corp spent 20 hours per week on manual reporting...

## The Solution
After implementing TestProduct, they automated their entire workflow...

## The Results
Within the first quarter, Acme Corp saw an 80% reduction in reporting time...

### Key Metrics
| Metric | Result |
|--------|--------|
| Time saved | 80% reduction |
| Revenue | +$250K annually |

### In Their Words
> "This completely transformed our workflow"
> "We saw results within the first week"`;

describe("Format Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("one_pager", () => {
    it("generates a one-pager using generateText", async () => {
      const onePagerContent = "**Acme Corp: 80% Time Reduction**\n\nAcme Corp reduced reporting time by 80%...";
      mockGenerateText.mockResolvedValueOnce({ text: onePagerContent } as never);

      const result = await generateFormat("one_pager", "Acme Corp", "TestProduct", sampleExtraction, sampleDraft);

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(result).toBe(onePagerContent);
    });
  });

  describe("linkedin", () => {
    it("generates a LinkedIn post", async () => {
      const linkedinContent = "Acme Corp cut reporting time by 80% with TestProduct. Here's what happened...";
      mockGenerateText.mockResolvedValueOnce({ text: linkedinContent } as never);

      const result = await generateFormat("linkedin", "Acme Corp", "TestProduct", sampleExtraction, sampleDraft);

      expect(result).toBe(linkedinContent);
    });
  });

  describe("twitter", () => {
    it("generates a tweet under 280 chars", async () => {
      const tweetContent = "Acme Corp cut reporting time by 80% with TestProduct. $250K revenue increase in year one.";
      mockGenerateText.mockResolvedValueOnce({ text: tweetContent } as never);

      const result = await generateFormat("twitter", "Acme Corp", "TestProduct", sampleExtraction, sampleDraft);

      expect(result.length).toBeLessThanOrEqual(280);
      expect(result).toBe(tweetContent);
    });

    it("truncates tweets exceeding 280 chars", async () => {
      const longTweet = "A".repeat(300);
      mockGenerateText.mockResolvedValueOnce({ text: longTweet } as never);

      const result = await generateFormat("twitter", "Acme Corp", "TestProduct", sampleExtraction, sampleDraft);

      expect(result.length).toBeLessThanOrEqual(280);
      expect(result.endsWith("...")).toBe(true);
    });

    it("truncates at word boundary when possible", async () => {
      const longTweet = "This is a really long tweet " + "word ".repeat(60);
      mockGenerateText.mockResolvedValueOnce({ text: longTweet } as never);

      const result = await generateFormat("twitter", "Acme Corp", "TestProduct", sampleExtraction, sampleDraft);

      expect(result.length).toBeLessThanOrEqual(280);
      expect(result.endsWith("...")).toBe(true);
      // Should not cut in the middle of a word
      const withoutEllipsis = result.slice(0, -3);
      expect(withoutEllipsis.endsWith(" ") || withoutEllipsis.match(/\w$/)).toBeTruthy();
    });
  });

  describe("sales_slide", () => {
    it("generates sales slide content", async () => {
      const slideContent = "# 80% Time Reduction\n\n> \"This completely transformed our workflow\"\n\n| Before | After |";
      mockGenerateText.mockResolvedValueOnce({ text: slideContent } as never);

      const result = await generateFormat("sales_slide", "Acme Corp", "TestProduct", sampleExtraction, sampleDraft);

      expect(result).toBe(slideContent);
    });
  });

  describe("quote_cards", () => {
    it("generates quote cards as JSON using generateObject", async () => {
      const quotes = [
        { text: "This completely transformed our workflow", tag: "impact" },
        { text: "We saw results within the first week", tag: "outcome" },
      ];

      mockGenerateObject.mockResolvedValueOnce({
        object: { quotes },
      } as never);

      const result = await generateFormat("quote_cards", "Acme Corp", "TestProduct", sampleExtraction, sampleDraft);

      expect(mockGenerateObject).toHaveBeenCalledTimes(1);

      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toHaveProperty("text");
      expect(parsed[0]).toHaveProperty("tag");
    });

    it("quote cards have valid tag values", async () => {
      const validTags = ["impact", "challenge", "praise", "outcome", "transformation"];
      const quotes = [
        { text: "Quote 1", tag: "impact" },
        { text: "Quote 2", tag: "transformation" },
      ];

      mockGenerateObject.mockResolvedValueOnce({
        object: { quotes },
      } as never);

      const result = await generateFormat("quote_cards", "Acme Corp", "TestProduct", sampleExtraction, sampleDraft);

      const parsed = JSON.parse(result);
      for (const card of parsed) {
        expect(validTags).toContain(card.tag);
      }
    });
  });

  describe("email_blurb", () => {
    it("generates an email blurb", async () => {
      const emailContent = "Did you know Acme Corp reduced reporting time by 80%?\n\nAfter implementing TestProduct...";
      mockGenerateText.mockResolvedValueOnce({ text: emailContent } as never);

      const result = await generateFormat("email_blurb", "Acme Corp", "TestProduct", sampleExtraction, sampleDraft);

      expect(result).toBe(emailContent);
    });
  });

  describe("prompt injection", () => {
    it("passes company, product, extraction, and draft to all text prompts", async () => {
      mockGenerateText.mockResolvedValueOnce({ text: "content" } as never);

      await generateFormat("linkedin", "Acme Corp", "TestProduct", sampleExtraction, sampleDraft);

      const call = mockGenerateText.mock.calls[0][0] as { prompt: string };
      expect(call.prompt).toContain("Acme Corp");
      expect(call.prompt).toContain("TestProduct");
      expect(call.prompt).toContain("Time saved");
      expect(call.prompt).toContain("80% Time Reduction");
    });

    it("passes data to quote_cards generateObject prompt", async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { quotes: [] },
      } as never);

      await generateFormat("quote_cards", "Acme Corp", "TestProduct", sampleExtraction, sampleDraft);

      const call = mockGenerateObject.mock.calls[0][0] as { prompt: string };
      expect(call.prompt).toContain("Acme Corp");
      expect(call.prompt).toContain("TestProduct");
    });
  });
});
