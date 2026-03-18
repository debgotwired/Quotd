"use client";

import { useState } from "react";

interface ExportButtonsProps {
  interviewId: string;
}

const formats = [
  { key: "md", label: ".md" },
  { key: "docx", label: ".docx" },
  { key: "pdf", label: ".pdf" },
  { key: "html", label: ".html" },
  { key: "txt", label: ".txt" },
] as const;

export function ExportButtons({ interviewId }: ExportButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (format: string) => {
    setLoading(format);
    try {
      const response = await fetch(`/api/interview/${interviewId}/export?format=${format}`);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `case-study.${format}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 mr-1">Export:</span>
      {formats.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => handleExport(key)}
          disabled={loading !== null}
          className="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
        >
          {loading === key ? "..." : label}
        </button>
      ))}
    </div>
  );
}
