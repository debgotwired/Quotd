"use client";

import type { ReviewSection } from "@/lib/supabase/types";

interface ReviewProgressProps {
  sections: ReviewSection[];
}

export function ReviewProgress({ sections }: ReviewProgressProps) {
  const reviewed = sections.filter((s) => s.status !== "pending").length;
  const total = sections.length;
  const pct = total > 0 ? (reviewed / total) * 100 : 0;

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Review Progress</span>
        <span className="text-sm text-gray-500">
          {reviewed} of {total} sections reviewed
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gray-900 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
