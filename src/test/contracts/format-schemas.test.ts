/**
 * Format API Contract Tests
 *
 * Zod schema validation for the format generation and edit API endpoints.
 * Ensures request and response shapes remain stable.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Format key enum
const FormatKeySchema = z.enum([
  "one_pager",
  "linkedin",
  "twitter",
  "sales_slide",
  "quote_cards",
  "email_blurb",
]);

// POST /api/interviews/[id]/formats request
const GenerateFormatRequestSchema = z.object({
  format: z.union([FormatKeySchema, z.literal("all")]),
});

// Generated format shape
const GeneratedFormatSchema = z.object({
  content: z.string(),
  generated_at: z.string(),
  edited: z.boolean().optional(),
});

// POST response — formats is a partial map (not all keys required)
const GenerateFormatResponseSchema = z.object({
  formats: z.record(z.string(), GeneratedFormatSchema),
  errors: z.array(z.string()).optional(),
});

// PUT request
const EditFormatRequestSchema = z.object({
  format: FormatKeySchema,
  content: z.string(),
});

// PUT response
const EditFormatResponseSchema = z.object({
  success: z.boolean(),
});

// Quote card shape
const QuoteCardSchema = z.object({
  text: z.string(),
  tag: z.enum(["impact", "challenge", "praise", "outcome", "transformation"]),
});

describe("Format API Contract Validation", () => {
  describe("POST /api/interviews/:id/formats", () => {
    it("accepts single format request", () => {
      const valid = { format: "linkedin" };
      expect(GenerateFormatRequestSchema.safeParse(valid).success).toBe(true);
    });

    it("accepts 'all' format request", () => {
      const valid = { format: "all" };
      expect(GenerateFormatRequestSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects invalid format key", () => {
      const invalid = { format: "blog_post" };
      expect(GenerateFormatRequestSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects missing format", () => {
      const invalid = {};
      expect(GenerateFormatRequestSchema.safeParse(invalid).success).toBe(false);
    });

    it("response matches GenerateFormatResponseSchema for single format", () => {
      const valid = {
        formats: {
          linkedin: {
            content: "Acme Corp reduced time by 80%...",
            generated_at: "2026-03-19T00:00:00.000Z",
          },
        },
      };
      expect(GenerateFormatResponseSchema.safeParse(valid).success).toBe(true);
    });

    it("response matches schema for all formats", () => {
      const valid = {
        formats: {
          one_pager: { content: "Executive briefing...", generated_at: "2026-03-19T00:00:00.000Z" },
          linkedin: { content: "LinkedIn post...", generated_at: "2026-03-19T00:00:00.000Z" },
          twitter: { content: "Tweet content", generated_at: "2026-03-19T00:00:00.000Z" },
          sales_slide: { content: "# Slide", generated_at: "2026-03-19T00:00:00.000Z" },
          quote_cards: { content: '[{"text":"quote","tag":"impact"}]', generated_at: "2026-03-19T00:00:00.000Z" },
          email_blurb: { content: "Email content...", generated_at: "2026-03-19T00:00:00.000Z" },
        },
      };
      expect(GenerateFormatResponseSchema.safeParse(valid).success).toBe(true);
    });

    it("response can include errors for partial failures", () => {
      const valid = {
        formats: {
          linkedin: { content: "Content here", generated_at: "2026-03-19T00:00:00.000Z" },
        },
        errors: ["twitter"],
      };
      expect(GenerateFormatResponseSchema.safeParse(valid).success).toBe(true);
    });

    it("response with edited flag", () => {
      const valid = {
        formats: {
          one_pager: {
            content: "Edited content",
            generated_at: "2026-03-19T00:00:00.000Z",
            edited: true,
          },
        },
      };
      expect(GenerateFormatResponseSchema.safeParse(valid).success).toBe(true);
    });
  });

  describe("PUT /api/interviews/:id/formats", () => {
    it("accepts valid edit request", () => {
      const valid = { format: "one_pager", content: "Updated briefing..." };
      expect(EditFormatRequestSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects edit with invalid format", () => {
      const invalid = { format: "invalid", content: "text" };
      expect(EditFormatRequestSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects edit without content", () => {
      const invalid = { format: "linkedin" };
      expect(EditFormatRequestSchema.safeParse(invalid).success).toBe(false);
    });

    it("response matches EditFormatResponseSchema", () => {
      const valid = { success: true };
      expect(EditFormatResponseSchema.safeParse(valid).success).toBe(true);
    });
  });

  describe("Quote Cards JSON shape", () => {
    it("validates well-formed quote cards", () => {
      const cards = [
        { text: "This transformed our workflow", tag: "impact" },
        { text: "Results in the first week", tag: "outcome" },
      ];

      const result = z.array(QuoteCardSchema).safeParse(cards);
      expect(result.success).toBe(true);
    });

    it("rejects quote card with invalid tag", () => {
      const cards = [{ text: "Quote", tag: "unknown" }];
      const result = z.array(QuoteCardSchema).safeParse(cards);
      expect(result.success).toBe(false);
    });

    it("rejects quote card without text", () => {
      const cards = [{ tag: "impact" }];
      const result = z.array(QuoteCardSchema).safeParse(cards);
      expect(result.success).toBe(false);
    });

    it("accepts empty array", () => {
      const result = z.array(QuoteCardSchema).safeParse([]);
      expect(result.success).toBe(true);
    });
  });
});

describe("Format Key Exhaustiveness", () => {
  const ALL_KEYS = ["one_pager", "linkedin", "twitter", "sales_slide", "quote_cards", "email_blurb"];

  it("FormatKeySchema accepts all 6 format keys", () => {
    for (const key of ALL_KEYS) {
      expect(FormatKeySchema.safeParse(key).success).toBe(true);
    }
  });

  it("FormatKeySchema rejects unknown keys", () => {
    expect(FormatKeySchema.safeParse("blog").success).toBe(false);
    expect(FormatKeySchema.safeParse("").success).toBe(false);
    expect(FormatKeySchema.safeParse(null).success).toBe(false);
  });
});
