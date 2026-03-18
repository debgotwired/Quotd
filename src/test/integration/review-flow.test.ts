import { describe, it, expect } from "vitest";
import { isInterviewDone, initReviewState } from "@/lib/review/helpers";
import { splitMarkdownIntoSections } from "@/lib/review/sections";
import type { ReviewState, ReviewSection } from "@/lib/supabase/types";

describe("Review Flow: helpers", () => {
  describe("isInterviewDone", () => {
    it("returns false for draft", () => {
      expect(isInterviewDone("draft")).toBe(false);
    });

    it("returns false for in_progress", () => {
      expect(isInterviewDone("in_progress")).toBe(false);
    });

    it("returns true for review_pending", () => {
      expect(isInterviewDone("review_pending")).toBe(true);
    });

    it("returns true for review_in_progress", () => {
      expect(isInterviewDone("review_in_progress")).toBe(true);
    });

    it("returns true for review_complete", () => {
      expect(isInterviewDone("review_complete")).toBe(true);
    });

    it("returns false for unknown status", () => {
      expect(isInterviewDone("unknown")).toBe(false);
    });
  });

  describe("initReviewState", () => {
    it("creates a review state from headings", () => {
      const headings = ["Challenge", "Solution", "Results"];
      const state = initReviewState(headings);

      expect(state.sections).toHaveLength(3);
      expect(state.started_at).toBeNull();
      expect(state.completed_at).toBeNull();
      expect(state.sections[0]).toEqual({
        id: "section-0",
        heading: "Challenge",
        status: "pending",
        comment: null,
      });
      expect(state.sections[2].id).toBe("section-2");
    });

    it("creates empty sections array for no headings", () => {
      const state = initReviewState([]);
      expect(state.sections).toHaveLength(0);
    });

    it("creates single section for single heading", () => {
      const state = initReviewState(["Full Document"]);
      expect(state.sections).toHaveLength(1);
      expect(state.sections[0].heading).toBe("Full Document");
    });
  });
});

describe("Review Flow: end-to-end state machine", () => {
  it("simulates full review flow", () => {
    // Step 1: Interview completes, draft is generated
    const draft = `# Acme x Widget Case Study

## Challenge

Acme struggled with manual processes.

## Solution

They adopted Widget to automate workflows.

## Results

Revenue increased by 40% in 6 months.`;

    // Step 2: Split into sections and init review state
    const sections = splitMarkdownIntoSections(draft);
    expect(sections).toHaveLength(4); // Intro + 3 H2s

    const headings = sections.map((s) => s.heading);
    const reviewState = initReviewState(headings);
    expect(reviewState.sections).toHaveLength(4);

    // All should be pending
    expect(reviewState.sections.every((s) => s.status === "pending")).toBe(true);

    // Step 3: Customer starts reviewing — approve first two, flag third
    const updatedSections: ReviewSection[] = reviewState.sections.map((s, i) => {
      if (i < 2) return { ...s, status: "approved" as const };
      if (i === 2) return { ...s, status: "flagged" as const, comment: "Numbers seem off" };
      return s;
    });

    // Verify mixed states
    expect(updatedSections[0].status).toBe("approved");
    expect(updatedSections[1].status).toBe("approved");
    expect(updatedSections[2].status).toBe("flagged");
    expect(updatedSections[2].comment).toBe("Numbers seem off");
    expect(updatedSections[3].status).toBe("pending");

    // Step 4: Customer approves the last section
    updatedSections[3] = { ...updatedSections[3], status: "approved" };

    // All sections now have a decision
    const allReviewed = updatedSections.every((s) => s.status !== "pending");
    expect(allReviewed).toBe(true);

    // Step 5: Submit review
    const finalState: ReviewState = {
      sections: updatedSections,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };

    expect(finalState.completed_at).toBeTruthy();
    expect(finalState.sections.filter((s) => s.status === "flagged")).toHaveLength(1);
    expect(finalState.sections.filter((s) => s.status === "approved")).toHaveLength(3);
  });

  it("handles draft with no H2 headings", () => {
    const draft = "Just a single paragraph case study with no structure.";
    const sections = splitMarkdownIntoSections(draft);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("Full Document");

    const state = initReviewState(sections.map((s) => s.heading));
    expect(state.sections).toHaveLength(1);
    expect(state.sections[0].heading).toBe("Full Document");
  });

  it("handles typical generated draft structure", () => {
    // Typical output from generateDraft
    const draft = `# How Acme Achieved 40% Revenue Growth with Widget

## The Challenge

Before Widget, Acme's team spent countless hours on manual data entry...

## The Solution

Widget's AI-powered automation transformed Acme's workflow...

## The Results

Within six months of implementing Widget, Acme saw dramatic improvements...

## Key Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Processing Time | 4 hours | 30 min | -87% |

## Customer Quotes

> "Widget completely changed how we operate." — Jane Doe, VP Operations`;

    const sections = splitMarkdownIntoSections(draft);
    // Intro (H1) + Challenge + Solution + Results + Key Metrics + Customer Quotes
    expect(sections).toHaveLength(6);
    expect(sections[0].heading).toBe("Introduction");
    expect(sections[1].heading).toBe("The Challenge");
    expect(sections[2].heading).toBe("The Solution");
    expect(sections[3].heading).toBe("The Results");
    expect(sections[4].heading).toBe("Key Metrics");
    expect(sections[5].heading).toBe("Customer Quotes");

    const state = initReviewState(sections.map((s) => s.heading));
    expect(state.sections).toHaveLength(6);
  });
});
