"use client";

import type { QuestionDropoff } from "@/lib/analytics/types";

export function QuestionDropoffChart({ dropoff }: { dropoff: QuestionDropoff[] }) {
  if (dropoff.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-medium text-gray-900 mb-4">Question Drop-off</h2>
        <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
      </div>
    );
  }

  const maxCount = Math.max(...dropoff.map((d) => d.count), 1);
  const chartWidth = 480;
  const chartHeight = 200;
  const padding = { top: 10, right: 10, bottom: 30, left: 40 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const barWidth = Math.max(Math.min(innerWidth / dropoff.length - 4, 32), 8);

  // Find steepest drop
  let steepestIdx = -1;
  let steepestDrop = 0;
  for (let i = 1; i < dropoff.length; i++) {
    const drop = dropoff[i - 1].count - dropoff[i].count;
    if (drop > steepestDrop) {
      steepestDrop = drop;
      steepestIdx = i;
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <h2 className="text-sm font-medium text-gray-900 mb-4">Question Drop-off</h2>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        style={{ maxHeight: "220px" }}
      >
        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padding.top + innerHeight * (1 - frac);
          const val = Math.round(maxCount * frac);
          return (
            <g key={frac}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="#f3f4f6"
                strokeWidth={1}
              />
              <text
                x={padding.left - 6}
                y={y + 4}
                textAnchor="end"
                className="text-[10px]"
                fill="#9ca3af"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {dropoff.map((d, i) => {
          const barHeight = (d.count / maxCount) * innerHeight;
          const x =
            padding.left +
            (innerWidth / dropoff.length) * i +
            (innerWidth / dropoff.length - barWidth) / 2;
          const y = padding.top + innerHeight - barHeight;
          const isSteepest = i === steepestIdx;

          return (
            <g key={d.question_number}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                fill={isSteepest ? "#ef4444" : "#1a1a1a"}
                opacity={isSteepest ? 0.8 : 0.7}
              />
              <text
                x={x + barWidth / 2}
                y={chartHeight - padding.bottom + 16}
                textAnchor="middle"
                className="text-[10px]"
                fill="#9ca3af"
              >
                Q{d.question_number}
              </text>
            </g>
          );
        })}
      </svg>
      {steepestIdx > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          Steepest drop: Q{dropoff[steepestIdx - 1].question_number} to Q
          {dropoff[steepestIdx].question_number} (-{steepestDrop})
        </p>
      )}
    </div>
  );
}
