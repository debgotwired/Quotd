import { describe, it, expect } from "vitest";
import { buildCustomerContext, buildInterviewSettings } from "@/lib/ai/context";

describe("buildCustomerContext", () => {
  it("returns empty string when both URLs are missing", () => {
    expect(buildCustomerContext()).toBe("");
    expect(buildCustomerContext(null, null)).toBe("");
    expect(buildCustomerContext(undefined, undefined)).toBe("");
  });

  it("returns only LinkedIn when company website is missing", () => {
    const result = buildCustomerContext("https://linkedin.com/in/janedoe", null);
    expect(result).toContain("LinkedIn profile: https://linkedin.com/in/janedoe");
    expect(result).not.toContain("Company website");
  });

  it("returns only company website when LinkedIn is missing", () => {
    const result = buildCustomerContext(null, "https://acmecorp.com");
    expect(result).toContain("Company website: https://acmecorp.com");
    expect(result).not.toContain("LinkedIn profile");
  });

  it("returns both when both URLs are provided", () => {
    const result = buildCustomerContext(
      "https://linkedin.com/in/janedoe",
      "https://acmecorp.com"
    );
    expect(result).toContain("Customer Context:");
    expect(result).toContain("LinkedIn profile: https://linkedin.com/in/janedoe");
    expect(result).toContain("Company website: https://acmecorp.com");
  });

  it("treats empty strings as missing", () => {
    expect(buildCustomerContext("", "")).toBe("");
  });
});

describe("buildInterviewSettings", () => {
  it("returns empty string when all defaults", () => {
    expect(buildInterviewSettings()).toBe("");
    expect(buildInterviewSettings("conversational", "balanced", "general")).toBe("");
  });

  it("returns settings when tone is non-default", () => {
    const result = buildInterviewSettings("formal", "balanced", "general");
    expect(result).toContain("Interview Settings:");
    expect(result).toContain("formal and professional");
  });

  it("returns settings when focus is non-default", () => {
    const result = buildInterviewSettings("conversational", "roi", "general");
    expect(result).toContain("ROI, cost savings, and revenue impact");
  });

  it("returns settings when audience is non-default", () => {
    const result = buildInterviewSettings("conversational", "balanced", "c_suite");
    expect(result).toContain("C-suite executives");
  });

  it("includes all three lines when all non-default", () => {
    const result = buildInterviewSettings("technical", "storytelling", "board");
    expect(result).toContain("technical and precise");
    expect(result).toContain("emotional storytelling");
    expect(result).toContain("board members and investors");
  });

  it("falls back to defaults for invalid values", () => {
    expect(buildInterviewSettings("invalid", "invalid", "invalid")).toBe("");
  });

  it("handles null and undefined", () => {
    expect(buildInterviewSettings(null, null, null)).toBe("");
    expect(buildInterviewSettings(undefined, undefined, undefined)).toBe("");
  });
});
