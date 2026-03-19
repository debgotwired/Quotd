"use client";

import { useEffect, useState, useCallback } from "react";
import type { AnalyticsResponse } from "@/lib/analytics/types";
import { FunnelChart } from "./funnel-chart";
import { QuestionDropoffChart } from "./question-dropoff-chart";
import { TimeStatsCards } from "./time-stats";
import { TrendChart } from "./trend-chart";
import { InterviewTable } from "./interview-table";

type Period = "7d" | "30d" | "90d" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?period=${period}`);
      if (!res.ok) {
        throw new Error("Failed to load analytics");
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          <FunnelChart funnel={data.funnel} rates={data.conversion_rates} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <QuestionDropoffChart dropoff={data.question_dropoff} />
            <TimeStatsCards stats={data.time_stats} />
          </div>

          <TrendChart trends={data.trends} />

          <InterviewTable interviews={data.interviews} />
        </>
      )}
    </div>
  );
}
