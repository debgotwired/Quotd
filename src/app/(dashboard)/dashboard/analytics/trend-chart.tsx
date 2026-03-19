"use client";

import type { TrendPoint } from "@/lib/analytics/types";

const LINES: { key: keyof Omit<TrendPoint, "period">; label: string; color: string }[] = [
  { key: "created", label: "Created", color: "#1a1a1a" },
  { key: "completed", label: "Completed", color: "#6366f1" },
  { key: "review_completed", label: "Review Done", color: "#22c55e" },
];

export function TrendChart({ trends }: { trends: TrendPoint[] }) {
  if (trends.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-medium text-gray-900 mb-4">Weekly Trends</h2>
        <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
      </div>
    );
  }

  const chartWidth = 600;
  const chartHeight = 220;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxValue = Math.max(
    ...trends.flatMap((t) => [t.created, t.completed, t.review_completed]),
    1
  );

  const xStep = trends.length > 1 ? innerWidth / (trends.length - 1) : innerWidth / 2;

  function getX(i: number): number {
    if (trends.length === 1) return padding.left + innerWidth / 2;
    return padding.left + i * xStep;
  }

  function getY(value: number): number {
    return padding.top + innerHeight - (value / maxValue) * innerHeight;
  }

  function buildPath(key: keyof Omit<TrendPoint, "period">): string {
    return trends
      .map((t, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(t[key] as number)}`)
      .join(" ");
  }

  // Show up to 8 X-axis labels
  const labelInterval = Math.max(1, Math.ceil(trends.length / 8));

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-900">Weekly Trends</h2>
        <div className="flex items-center gap-4">
          {LINES.map((line) => (
            <div key={line.key} className="flex items-center gap-1.5">
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: line.color }}
              />
              <span className="text-xs text-gray-500">{line.label}</span>
            </div>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        style={{ maxHeight: "240px" }}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padding.top + innerHeight * (1 - frac);
          const val = Math.round(maxValue * frac);
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

        {/* X-axis labels */}
        {trends.map((t, i) => {
          if (i % labelInterval !== 0 && i !== trends.length - 1) return null;
          const label = t.period.slice(5); // MM-DD
          return (
            <text
              key={t.period}
              x={getX(i)}
              y={chartHeight - padding.bottom + 20}
              textAnchor="middle"
              className="text-[10px]"
              fill="#9ca3af"
            >
              {label}
            </text>
          );
        })}

        {/* Lines + dots */}
        {LINES.map((line) => (
          <g key={line.key}>
            <path
              d={buildPath(line.key)}
              fill="none"
              stroke={line.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {trends.map((t, i) => (
              <circle
                key={i}
                cx={getX(i)}
                cy={getY(t[line.key] as number)}
                r={3}
                fill="white"
                stroke={line.color}
                strokeWidth={2}
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
