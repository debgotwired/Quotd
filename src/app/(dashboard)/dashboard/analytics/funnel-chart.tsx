"use client";

import type { FunnelData, ConversionRates } from "@/lib/analytics/types";

const STAGES: { key: keyof FunnelData; label: string; rateKey: keyof ConversionRates | null }[] = [
  { key: "created", label: "Created", rateKey: null },
  { key: "opened", label: "Opened", rateKey: "created_to_opened" },
  { key: "started", label: "Started", rateKey: "opened_to_started" },
  { key: "completed", label: "Completed", rateKey: "started_to_completed" },
  { key: "review_started", label: "Review Started", rateKey: "completed_to_review_started" },
  { key: "review_completed", label: "Review Done", rateKey: "review_started_to_completed" },
];

export function FunnelChart({
  funnel,
  rates,
}: {
  funnel: FunnelData;
  rates: ConversionRates;
}) {
  const max = Math.max(funnel.created, 1);

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-medium text-gray-900">Conversion Funnel</h2>
        <span className="text-xs text-gray-400">
          {rates.overall}% overall conversion
        </span>
      </div>
      <div className="space-y-3">
        {STAGES.map((stage, i) => {
          const count = funnel[stage.key];
          const width = Math.max((count / max) * 100, 2);
          const opacity = 1 - i * 0.13;

          return (
            <div key={stage.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">{stage.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                  {stage.rateKey && (
                    <span className="text-xs text-gray-400">
                      {rates[stage.rateKey]}%
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full h-6 bg-gray-100 rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md transition-all duration-500"
                  style={{
                    width: `${width}%`,
                    backgroundColor: `rgba(26, 26, 26, ${opacity})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
