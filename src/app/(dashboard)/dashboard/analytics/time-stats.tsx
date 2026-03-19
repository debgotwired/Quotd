"use client";

import type { TimeStats } from "@/lib/analytics/types";

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "--";
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
  }
  const days = Math.floor(minutes / 1440);
  const hrs = Math.round((minutes % 1440) / 60);
  return hrs > 0 ? `${days} days ${hrs} hr` : `${days} days`;
}

const CARDS: { key: keyof TimeStats; label: string; description: string }[] = [
  {
    key: "median_interview_minutes",
    label: "Interview Time",
    description: "Median time to complete interview",
  },
  {
    key: "median_review_minutes",
    label: "Review Time",
    description: "Median time to complete review",
  },
  {
    key: "median_total_minutes",
    label: "Total Time",
    description: "Median start to review done",
  },
];

export function TimeStatsCards({ stats }: { stats: TimeStats }) {
  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <h2 className="text-sm font-medium text-gray-900 mb-4">Timing (Median)</h2>
      <div className="space-y-4">
        {CARDS.map((card) => (
          <div
            key={card.key}
            className="bg-gray-50 rounded-lg p-4"
          >
            <div className="text-2xl font-semibold text-gray-900">
              {formatDuration(stats[card.key])}
            </div>
            <div className="text-sm text-gray-500 mt-1">{card.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{card.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
