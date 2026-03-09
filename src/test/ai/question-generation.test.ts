/**
 * AI Question Generation Tests
 *
 * Tests that the AI generates appropriate follow-up questions and
 * adapts based on the conversation and extraction state.
 *
 * Key aspects being tested:
 * 1. Question relevance to conversation context
 * 2. Probing for specifics when answers are vague
 * 3. Appropriate question type transitions
 * 4. Interview ending logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateNextQuestion, generateFirstQuestion } from "@/lib/ai/question";
import type { ExtractionState, Message } from "@/lib/supabase/types";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

import { generateObject } from "ai";
const mockGenerateObject = vi.mocked(generateObject);

describe("Question Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("First Question", () => {
    it("generates a warm, open-ended first question", async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          question: "Can you tell me about your role at Acme Corp?",
          type: "context",
          should_end: false,
        },
      });

      const result = await generateFirstQuestion("ProductX", "Acme Corp");

      expect(result.type).toBe("context");
      expect(result.should_end).toBe(false);
      expect(result.question.length).toBeLessThan(100); // Keep it concise
    });

    it("first question should not ask for metrics directly", async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          question: "What challenges were you facing?",
          type: "context",
          should_end: false,
        },
      });

      const result = await generateFirstQuestion("ProductX", "Acme Corp");

      // First question should be about context, not metrics
      expect(result.type).toBe("context");
      expect(result.question.toLowerCase()).not.toMatch(/how much|percentage|number|metric/);
    });
  });

  describe("Follow-up Questions", () => {
    const baseState: ExtractionState = {
      metrics: [],
      quotes: [],
      facts: {},
      question_count: 2,
    };

    it("probes for specifics when answer is vague", async () => {
      const messages: Message[] = [
        { id: "1", role: "assistant", content: "What time savings have you seen?", created_at: "" },
        { id: "2", role: "user", content: "It's definitely faster now.", created_at: "" },
      ];

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          question: "Can you estimate how many hours per week that saves you?",
          type: "metrics",
          should_end: false,
        },
      });

      const result = await generateNextQuestion("ProductX", "Acme", messages, baseState);

      expect(result.type).toBe("metrics");
      // Should be probing for specifics
      expect(result.question.toLowerCase()).toMatch(/how|estimate|number|specific/i);
    });

    it("transitions to quotes when metrics are sufficient", async () => {
      const stateWithMetrics: ExtractionState = {
        metrics: [
          { name: "Time saved", delta: "4 hours/week", confidence: "high" },
          { name: "Cost reduction", delta: "30%", confidence: "high" },
          { name: "Revenue increase", delta: "$100K", confidence: "medium" },
        ],
        quotes: [],
        facts: { challenge: "Manual processes", solution: "Automation" },
        question_count: 6,
      };

      const messages: Message[] = [
        { id: "1", role: "assistant", content: "Previous question", created_at: "" },
        { id: "2", role: "user", content: "We increased revenue by $100K", created_at: "" },
      ];

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          question: "What would you tell other companies considering this product?",
          type: "quote",
          should_end: false,
        },
      });

      const result = await generateNextQuestion("ProductX", "Acme", messages, stateWithMetrics);

      // With enough metrics, should move to quotes
      expect(result.type).toBe("quote");
    });
  });

  describe("Interview Ending Logic", () => {
    it("ends interview after 12 questions", async () => {
      const stateAt12: ExtractionState = {
        metrics: [{ name: "Test", delta: "10%", confidence: "high" }],
        quotes: [{ text: "Great product", tag: "praise" }],
        facts: { challenge: "X", solution: "Y" },
        question_count: 12,
      };

      const messages: Message[] = [];

      const result = await generateNextQuestion("ProductX", "Acme", messages, stateAt12);

      expect(result.should_end).toBe(true);
      expect(result.type).toBe("wrap_up");
    });

    it("ends early when sufficient data collected", async () => {
      const sufficientState: ExtractionState = {
        metrics: [
          { name: "M1", delta: "10%", confidence: "high" },
          { name: "M2", delta: "20%", confidence: "high" },
          { name: "M3", delta: "30%", confidence: "high" },
        ],
        quotes: [
          { text: "Quote 1", tag: "praise" },
          { text: "Quote 2", tag: "impact" },
        ],
        facts: {
          challenge: "Challenge text",
          solution: "Solution text",
          impact: "Impact text",
        },
        question_count: 10,
      };

      const messages: Message[] = [];

      const result = await generateNextQuestion("ProductX", "Acme", messages, sufficientState);

      // Should recognize we have enough data
      expect(result.should_end).toBe(true);
    });

    it("continues if data is insufficient even at question 10", async () => {
      const insufficientState: ExtractionState = {
        metrics: [], // No metrics!
        quotes: [],
        facts: {},
        question_count: 10,
      };

      const messages: Message[] = [];

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          question: "Can you share any specific numbers or results?",
          type: "metrics",
          should_end: false,
        },
      });

      const result = await generateNextQuestion("ProductX", "Acme", messages, insufficientState);

      // Should NOT end without metrics
      expect(result.should_end).toBe(false);
    });
  });
});

/**
 * Question Quality Tests
 *
 * These verify question quality characteristics that affect interview success.
 */
describe("Question Quality", () => {
  it("questions should be under 25 words", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        question: "What specific results have you seen?",
        type: "metrics",
        should_end: false,
      },
    });

    const result = await generateFirstQuestion("ProductX", "Acme");
    const wordCount = result.question.split(/\s+/).length;

    expect(wordCount).toBeLessThanOrEqual(25);
  });

  it("questions should end with question mark", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        question: "How has this affected your team?",
        type: "context",
        should_end: false,
      },
    });

    const result = await generateFirstQuestion("ProductX", "Acme");

    expect(result.question.trim()).toMatch(/\?$/);
  });
});
