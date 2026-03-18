import type { InterviewStatus, ReviewState } from "@/lib/supabase/types";

/**
 * Returns true if the interview has finished the Q&A phase
 * (i.e. draft exists, customer may be reviewing or already done).
 */
export function isInterviewDone(status: InterviewStatus | string): boolean {
  return (
    status === "review_pending" ||
    status === "review_in_progress" ||
    status === "review_complete"
  );
}

/**
 * Build an initial ReviewState from an array of section headings.
 */
export function initReviewState(headings: string[]): ReviewState {
  return {
    sections: headings.map((heading, i) => ({
      id: `section-${i}`,
      heading,
      status: "pending",
      comment: null,
    })),
    started_at: null,
    completed_at: null,
  };
}
