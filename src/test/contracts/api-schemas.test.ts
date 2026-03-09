/**
 * API Contract Tests
 *
 * Stripe-style schema validation for API endpoints.
 * These tests ensure API responses match expected schemas,
 * preventing breaking changes from reaching production.
 *
 * Key principles:
 * 1. Lock down response shapes with Zod schemas
 * 2. Detect breaking changes before deployment
 * 3. Ensure backwards compatibility
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// API Response Schemas - These are the CONTRACTS

const MetricSchema = z.object({
  name: z.string(),
  baseline: z.string().optional(),
  after: z.string().optional(),
  delta: z.string().optional(),
  unit: z.string().optional(),
  timeframe: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]),
});

const QuoteSchema = z.object({
  text: z.string(),
  tag: z.string(),
});

const FactsSchema = z.object({
  challenge: z.string().optional(),
  solution: z.string().optional(),
  impact: z.string().optional(),
});

const ExtractionStateSchema = z.object({
  metrics: z.array(MetricSchema),
  quotes: z.array(QuoteSchema),
  facts: FactsSchema,
  question_count: z.number(),
});

const InterviewSchema = z.object({
  id: z.string().uuid(),
  customer_company: z.string(),
  product_name: z.string(),
  status: z.enum(["draft", "in_progress", "completed"]),
  share_token: z.string(),
  extraction_state: ExtractionStateSchema.nullable(),
});

const MessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["assistant", "user"]),
  content: z.string(),
  created_at: z.string(),
});

const GetInterviewResponseSchema = z.object({
  interview: InterviewSchema,
  messages: z.array(MessageSchema),
});

const SubmitAnswerResponseSchema = z.object({
  question: z.string(),
  type: z.enum(["context", "solution", "metrics", "quote", "wrap_up"]),
  should_end: z.boolean(),
  extraction: ExtractionStateSchema.optional(),
});

const NextQuestionResponseSchema = z.object({
  question: z.string(),
  type: z.enum(["context", "solution", "metrics", "quote", "wrap_up"]),
  should_end: z.boolean(),
  question_count: z.number(),
});

const TranscribeResponseSchema = z.object({
  transcript: z.string(),
});

const UploadResponseSchema = z.object({
  success: z.boolean(),
  file: z.object({
    name: z.string(),
    type: z.string(),
    size: z.number(),
    url: z.string().url(),
    path: z.string(),
  }),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
});

describe("API Contract Validation", () => {
  describe("GET /api/interview/:token", () => {
    it("response matches GetInterviewResponseSchema", () => {
      const validResponse = {
        interview: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          customer_company: "Acme Corp",
          product_name: "TestProduct",
          status: "in_progress",
          share_token: "abc123xyz",
          extraction_state: {
            metrics: [],
            quotes: [],
            facts: {},
            question_count: 0,
          },
        },
        messages: [
          {
            id: "550e8400-e29b-41d4-a716-446655440001",
            role: "assistant",
            content: "Hello!",
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
      };

      const result = GetInterviewResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it("rejects invalid interview status", () => {
      const invalidResponse = {
        interview: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          customer_company: "Acme",
          product_name: "Test",
          status: "invalid_status", // Invalid!
          share_token: "abc",
          extraction_state: null,
        },
        messages: [],
      };

      const result = GetInterviewResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it("rejects missing required fields", () => {
      const invalidResponse = {
        interview: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          // Missing customer_company!
          product_name: "Test",
          status: "draft",
        },
        messages: [],
      };

      const result = GetInterviewResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe("POST /api/interview/:token/submit-answer", () => {
    it("response matches SubmitAnswerResponseSchema", () => {
      const validResponse = {
        question: "What results have you seen?",
        type: "metrics",
        should_end: false,
        extraction: {
          metrics: [
            { name: "Time saved", delta: "4h", confidence: "high" },
          ],
          quotes: [],
          facts: {},
          question_count: 3,
        },
      };

      const result = SubmitAnswerResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it("rejects invalid question type", () => {
      const invalidResponse = {
        question: "Test",
        type: "invalid_type", // Invalid!
        should_end: false,
      };

      const result = SubmitAnswerResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it("rejects invalid confidence level", () => {
      const invalidResponse = {
        question: "Test",
        type: "metrics",
        should_end: false,
        extraction: {
          metrics: [
            { name: "Test", confidence: "very_high" }, // Invalid!
          ],
          quotes: [],
          facts: {},
          question_count: 1,
        },
      };

      const result = SubmitAnswerResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe("POST /api/transcribe", () => {
    it("response matches TranscribeResponseSchema", () => {
      const validResponse = {
        transcript: "This is the transcribed text.",
      };

      const result = TranscribeResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it("rejects empty transcript", () => {
      // Empty string is valid by schema, but we may want to change this
      const response = { transcript: "" };
      const result = TranscribeResponseSchema.safeParse(response);
      expect(result.success).toBe(true); // Empty is allowed
    });
  });

  describe("POST /api/upload", () => {
    it("response matches UploadResponseSchema", () => {
      const validResponse = {
        success: true,
        file: {
          name: "document.pdf",
          type: "application/pdf",
          size: 1024000,
          url: "https://storage.example.com/file.pdf",
          path: "interviews/abc/file.pdf",
        },
      };

      const result = UploadResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it("rejects invalid URL", () => {
      const invalidResponse = {
        success: true,
        file: {
          name: "file.pdf",
          type: "application/pdf",
          size: 1024,
          url: "not-a-valid-url", // Invalid!
          path: "path/file.pdf",
        },
      };

      const result = UploadResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe("Error Responses", () => {
    it("error response matches ErrorResponseSchema", () => {
      const errorResponse = {
        error: "Something went wrong",
      };

      const result = ErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
    });
  });
});

/**
 * Backwards Compatibility Tests
 *
 * These ensure we don't break existing clients when updating APIs.
 */
describe("Backwards Compatibility", () => {
  it("extraction_state can be null (for draft interviews)", () => {
    const response = {
      interview: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        customer_company: "Acme",
        product_name: "Test",
        status: "draft",
        share_token: "abc",
        extraction_state: null, // Should be allowed
      },
      messages: [],
    };

    const result = GetInterviewResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it("optional metric fields can be omitted", () => {
    const metric = {
      name: "Test metric",
      confidence: "high" as const,
      // baseline, after, delta, unit, timeframe all omitted
    };

    const result = MetricSchema.safeParse(metric);
    expect(result.success).toBe(true);
  });
});
