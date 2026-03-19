"use client";

import { useState, useMemo } from "react";
import type { InterviewRow } from "@/lib/analytics/types";

type SortKey =
  | "customer_company"
  | "status"
  | "created_at"
  | "opened_at"
  | "started_at"
  | "completed_at"
  | "review_completed_at"
  | "question_count"
  | "duration";

type SortDir = "asc" | "desc";

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "--";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

function durationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return (new Date(end).getTime() - new Date(start).getTime()) / 60000;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "--";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-400",
  in_progress: "bg-gray-400",
  review_pending: "bg-amber-400",
  review_in_progress: "bg-blue-400",
  review_complete: "bg-green-400",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Waiting",
  in_progress: "In progress",
  review_pending: "Awaiting review",
  review_in_progress: "Under review",
  review_complete: "Review done",
};

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "customer_company", label: "Company" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created" },
  { key: "opened_at", label: "Opened" },
  { key: "started_at", label: "Started" },
  { key: "completed_at", label: "Completed" },
  { key: "review_completed_at", label: "Review Done" },
  { key: "question_count", label: "Qs" },
  { key: "duration", label: "Duration" },
];

export function InterviewTable({ interviews }: { interviews: InterviewRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const rows = [...interviews];
    const dir = sortDir === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      if (sortKey === "duration") {
        aVal = durationMinutes(a.started_at, a.review_completed_at ?? a.completed_at);
        bVal = durationMinutes(b.started_at, b.review_completed_at ?? b.completed_at);
      } else if (sortKey === "question_count") {
        aVal = a.question_count;
        bVal = b.question_count;
      } else {
        aVal = a[sortKey as keyof InterviewRow] as string | null;
        bVal = b[sortKey as keyof InterviewRow] as string | null;
      }

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });

    return rows;
  }, [interviews, sortKey, sortDir]);

  if (interviews.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-medium text-gray-900 mb-4">Interviews</h2>
        <p className="text-sm text-gray-400 py-4 text-center">No interviews yet</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-900">Interviews ({interviews.length})</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 whitespace-nowrap select-none"
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((row) => {
              const dur = durationMinutes(
                row.started_at,
                row.review_completed_at ?? row.completed_at
              );

              return (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {row.customer_company}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          STATUS_COLORS[row.status] || "bg-gray-400"
                        }`}
                      />
                      <span className="text-gray-600">
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {relativeTime(row.created_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {relativeTime(row.opened_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {relativeTime(row.started_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {relativeTime(row.completed_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {relativeTime(row.review_completed_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {row.question_count || "--"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDuration(dur)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
