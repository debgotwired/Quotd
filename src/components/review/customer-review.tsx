"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { DraftEditor } from "@/components/editor/draft-editor";
import { ReviewProgress } from "./review-progress";
import { SectionChecklist } from "./section-checklist";
import type { ReviewState, ReviewSection, Branding } from "@/lib/supabase/types";

interface CustomerReviewProps {
  token: string;
  productName: string;
  customerCompany: string;
  draftContent: string;
  customerDraftContent: string | null;
  initialReviewState: ReviewState;
  status: string;
  branding?: Branding;
}

export function CustomerReview({
  token,
  productName,
  customerCompany,
  draftContent,
  customerDraftContent,
  initialReviewState,
  status,
  branding,
}: CustomerReviewProps) {
  const primaryColor = branding?.primary_color || "#1a1a1a";
  const [sections, setSections] = useState<ReviewSection[]>(initialReviewState.sections);
  const [submitted, setSubmitted] = useState(status === "review_complete");
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isReadOnly = submitted;

  // Auto-save review state on section changes
  const saveReviewState = useCallback(
    async (updatedSections: ReviewSection[]) => {
      setSaveError(null);
      try {
        const res = await fetch(`/api/interview/${token}/review`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            review_state: { sections: updatedSections },
          }),
        });
        if (!res.ok) {
          setSaveError("Failed to save review progress");
        }
      } catch {
        setSaveError("Failed to save review progress");
      }
    },
    [token]
  );

  const handleSectionsChange = useCallback(
    (updatedSections: ReviewSection[]) => {
      setSections(updatedSections);
      // Debounce save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveReviewState(updatedSections);
      }, 800);
    },
    [saveReviewState]
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const allReviewed = sections.every((s) => s.status !== "pending");

  const handleSubmit = async () => {
    // Save any pending review state first
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await saveReviewState(sections);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/interview/${token}/review/complete`, {
        method: "POST",
      });
      if (!res.ok) {
        setSaveError("Failed to submit review");
        return;
      }
      setSubmitted(true);
    } catch {
      setSaveError("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Review Submitted</h1>
          <p className="text-gray-500">
            Thank you for reviewing the case study for <span className="font-medium text-gray-900">{productName}</span>.
            The team will incorporate your feedback.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">{customerCompany}</p>
          <h1 className="text-lg font-semibold text-gray-900 mt-0.5">
            Review your case study for {productName}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <ReviewProgress sections={sections} />

        {/* Editor */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Case Study Draft</h2>
          <p className="text-xs text-gray-400 mb-3">
            You can edit the text below. Your changes are saved separately from the original.
          </p>
          <DraftEditor
            content={customerDraftContent || draftContent}
            interviewId={token}
            saveUrl={`/api/interview/${token}/customer-draft`}
            readOnly={isReadOnly}
          />
        </div>

        {/* Section checklist */}
        <SectionChecklist
          sections={sections}
          onChange={handleSectionsChange}
          disabled={isReadOnly}
        />

        {saveError && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{saveError}</p>
        )}

        {/* Submit */}
        <div className="border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allReviewed || submitting}
            className="w-full py-3 px-4 text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: primaryColor }}
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
          {!allReviewed && (
            <p className="text-xs text-gray-400 text-center mt-2">
              Approve or flag all sections to submit your review.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
