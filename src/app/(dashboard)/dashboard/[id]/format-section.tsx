"use client";

import { useState } from "react";
import { FormatCard } from "./format-card";
import type { FormatKey, GeneratedFormat, GeneratedFormats } from "@/lib/supabase/types";

const FORMAT_KEYS: FormatKey[] = [
  "one_pager",
  "linkedin",
  "twitter",
  "sales_slide",
  "quote_cards",
  "email_blurb",
];

interface FormatSectionProps {
  interviewId: string;
  initialFormats: GeneratedFormats | null;
}

export function FormatSection({ interviewId, initialFormats }: FormatSectionProps) {
  const [formats, setFormats] = useState<GeneratedFormats>(initialFormats || {});
  const [open, setOpen] = useState(true);
  const [generatingAll, setGeneratingAll] = useState(false);

  const handleGenerated = (key: FormatKey, data: GeneratedFormat) => {
    setFormats((prev) => ({ ...prev, [key]: data }));
  };

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/formats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "all" }),
      });
      if (!res.ok) throw new Error("Generate all failed");
      const json = await res.json();
      setFormats((prev) => ({ ...prev, ...json.formats }));
    } catch (err) {
      console.error("Generate all error:", err);
    } finally {
      setGeneratingAll(false);
    }
  };

  const generatedCount = FORMAT_KEYS.filter((k) => formats[k]).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-gray-700 transition-colors"
        >
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          Content Formats
          {generatedCount > 0 && (
            <span className="text-xs font-normal text-gray-400">
              {generatedCount}/{FORMAT_KEYS.length}
            </span>
          )}
        </button>
        {open && (
          <button
            onClick={handleGenerateAll}
            disabled={generatingAll}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {generatingAll ? "Generating..." : "Generate All"}
          </button>
        )}
      </div>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FORMAT_KEYS.map((key) => (
            <FormatCard
              key={key}
              formatKey={key}
              data={formats[key]}
              interviewId={interviewId}
              onGenerated={handleGenerated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
