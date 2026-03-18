"use client";

import type { ReviewSection } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface SectionChecklistProps {
  sections: ReviewSection[];
  onChange: (sections: ReviewSection[]) => void;
  disabled?: boolean;
}

export function SectionChecklist({ sections, onChange, disabled = false }: SectionChecklistProps) {
  const updateSection = (index: number, updates: Partial<ReviewSection>) => {
    const next = sections.map((s, i) => (i === index ? { ...s, ...updates } : s));
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Section Review</h3>
      {sections.map((section, i) => (
        <div key={section.id} className="border border-gray-200 rounded-xl p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-900 text-sm">{section.heading}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => updateSection(i, { status: "approved", comment: section.comment })}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-lg transition-colors",
                  section.status === "approved"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => updateSection(i, { status: "flagged" })}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-lg transition-colors",
                  section.status === "flagged"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-700",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                Flag
              </button>
            </div>
          </div>
          {section.status === "flagged" && (
            <textarea
              placeholder="What needs to change?"
              value={section.comment || ""}
              onChange={(e) => updateSection(i, { comment: e.target.value })}
              disabled={disabled}
              className="w-full text-sm border border-gray-200 rounded-lg p-3 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
              rows={2}
            />
          )}
        </div>
      ))}
    </div>
  );
}
