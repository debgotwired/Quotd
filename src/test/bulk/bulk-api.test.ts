/**
 * Bulk API Route Validation Tests
 *
 * Tests for the bulk interview creation API endpoint.
 * Validates request/response schemas, input validation,
 * and batch size limits.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Request schema - matches what the bulk API expects
const BulkInterviewInputSchema = z.object({
  customer_company: z.string().min(1).max(200),
  product_name: z.string().min(1).max(200),
  customer_email: z.string().email().optional().nullable(),
  linkedin_profile_url: z.string().url().optional().nullable(),
  company_website_url: z.string().url().optional().nullable(),
  interview_tone: z.enum(["formal", "conversational", "technical"]).optional(),
  interview_focus: z.enum(["balanced", "roi", "technical", "storytelling"]).optional(),
  target_audience: z.enum(["general", "c_suite", "technical_buyer", "end_user", "board"]).optional(),
  question_limit: z.number().int().min(5).max(30).optional(),
});

const BulkCreateRequestSchema = z.object({
  interviews: z.array(BulkInterviewInputSchema).min(1).max(100),
});

// Response schema
const BulkCreatedInterviewSchema = z.object({
  id: z.string(),
  customer_company: z.string(),
  product_name: z.string(),
  customer_email: z.string().nullable(),
  share_token: z.string(),
  status: z.string(),
});

const BulkCreateResponseSchema = z.object({
  created: z.number(),
  interviews: z.array(BulkCreatedInterviewSchema),
});

const BulkErrorResponseSchema = z.object({
  error: z.string(),
  validation_errors: z.array(z.object({
    index: z.number(),
    field: z.string(),
    message: z.string(),
  })).optional(),
});

describe("Bulk API Contract Validation", () => {
  describe("Request Validation", () => {
    it("accepts valid minimal request", () => {
      const request = {
        interviews: [
          { customer_company: "Acme Corp", product_name: "Quotd" },
        ],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("accepts valid request with all fields", () => {
      const request = {
        interviews: [
          {
            customer_company: "Acme Corp",
            product_name: "Quotd",
            customer_email: "alice@acme.com",
            linkedin_profile_url: "https://linkedin.com/in/alice",
            company_website_url: "https://acme.com",
            interview_tone: "formal" as const,
            interview_focus: "roi" as const,
            target_audience: "c_suite" as const,
            question_limit: 20,
          },
        ],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("accepts multiple interviews in a batch", () => {
      const request = {
        interviews: [
          { customer_company: "Acme Corp", product_name: "Quotd" },
          { customer_company: "Globex Inc", product_name: "Quotd" },
          { customer_company: "Initech", product_name: "Quotd" },
        ],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("rejects empty interviews array", () => {
      const request = { interviews: [] };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("rejects missing interviews field", () => {
      const request = {};

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("rejects request exceeding max batch size", () => {
      const interviews = Array.from({ length: 101 }, (_, i) => ({
        customer_company: `Company ${i}`,
        product_name: "Quotd",
      }));

      const request = { interviews };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("rejects empty customer_company", () => {
      const request = {
        interviews: [{ customer_company: "", product_name: "Quotd" }],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("rejects empty product_name", () => {
      const request = {
        interviews: [{ customer_company: "Acme", product_name: "" }],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("rejects customer_company exceeding 200 chars", () => {
      const request = {
        interviews: [{ customer_company: "A".repeat(201), product_name: "Quotd" }],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const request = {
        interviews: [
          {
            customer_company: "Acme",
            product_name: "Quotd",
            customer_email: "not-an-email",
          },
        ],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("rejects invalid interview tone", () => {
      const request = {
        interviews: [
          {
            customer_company: "Acme",
            product_name: "Quotd",
            interview_tone: "aggressive",
          },
        ],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("rejects invalid interview focus", () => {
      const request = {
        interviews: [
          {
            customer_company: "Acme",
            product_name: "Quotd",
            interview_focus: "random",
          },
        ],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("rejects invalid target audience", () => {
      const request = {
        interviews: [
          {
            customer_company: "Acme",
            product_name: "Quotd",
            target_audience: "aliens",
          },
        ],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("rejects question limit below 5", () => {
      const request = {
        interviews: [
          {
            customer_company: "Acme",
            product_name: "Quotd",
            question_limit: 2,
          },
        ],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("rejects question limit above 30", () => {
      const request = {
        interviews: [
          {
            customer_company: "Acme",
            product_name: "Quotd",
            question_limit: 50,
          },
        ],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("accepts null customer_email", () => {
      const request = {
        interviews: [
          {
            customer_company: "Acme",
            product_name: "Quotd",
            customer_email: null,
          },
        ],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe("Response Validation", () => {
    it("valid response matches schema", () => {
      const response = {
        created: 2,
        interviews: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            customer_company: "Acme Corp",
            product_name: "Quotd",
            customer_email: "alice@acme.com",
            share_token: "abc123def456",
            status: "draft",
          },
          {
            id: "550e8400-e29b-41d4-a716-446655440001",
            customer_company: "Globex Inc",
            product_name: "Quotd",
            customer_email: null,
            share_token: "ghi789jkl012",
            status: "draft",
          },
        ],
      };

      const result = BulkCreateResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("valid error response matches schema", () => {
      const response = {
        error: "Validation failed",
        validation_errors: [
          { index: 0, field: "customer_company", message: "Customer company is required" },
          { index: 2, field: "product_name", message: "Product name is required" },
        ],
      };

      const result = BulkErrorResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("simple error response matches schema", () => {
      const response = {
        error: "Unauthorized",
      };

      const result = BulkErrorResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("accepts exactly 100 interviews (max batch)", () => {
      const interviews = Array.from({ length: 100 }, (_, i) => ({
        customer_company: `Company ${i}`,
        product_name: "Quotd",
      }));

      const request = { interviews };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("accepts exactly 1 interview (min batch)", () => {
      const request = {
        interviews: [{ customer_company: "Solo Corp", product_name: "Quotd" }],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("accepts question limit at boundary (5)", () => {
      const request = {
        interviews: [
          { customer_company: "Acme", product_name: "Quotd", question_limit: 5 },
        ],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("accepts question limit at boundary (30)", () => {
      const request = {
        interviews: [
          { customer_company: "Acme", product_name: "Quotd", question_limit: 30 },
        ],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("accepts company name at max length (200)", () => {
      const request = {
        interviews: [
          { customer_company: "A".repeat(200), product_name: "Quotd" },
        ],
      };

      const result = BulkCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });
});
