"use client";

import { useState } from "react";
import type { FormatKey, GeneratedFormat } from "@/lib/supabase/types";

const FORMAT_META: Record<FormatKey, { label: string; description: string }> = {
  one_pager: { label: "One-Pager", description: "Executive briefing, ~300 words" },
  linkedin: { label: "LinkedIn Post", description: "Professional, 1-3 paragraphs" },
  twitter: { label: "Twitter/X Post", description: "280 chars, punchy highlight" },
  sales_slide: { label: "Sales Slide", description: "Headline metric + quote + data" },
  quote_cards: { label: "Quote Cards", description: "One card per extracted quote" },
  email_blurb: { label: "Email Blurb", description: "2-3 paragraph sales email" },
};

type QuoteCard = { text: string; tag: string };

interface FormatCardProps {
  formatKey: FormatKey;
  data?: GeneratedFormat | null;
  interviewId: string;
  onGenerated: (key: FormatKey, data: GeneratedFormat) => void;
}

export function FormatCard({ formatKey, data, interviewId, onGenerated }: FormatCardProps) {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const meta = FORMAT_META[formatKey];

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/formats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: formatKey }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const json = await res.json();
      const generated = json.formats[formatKey];
      if (generated) onGenerated(formatKey, generated);
    } catch (err) {
      console.error("Format generation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!data) return;
    const text = formatKey === "quote_cards" ? formatQuoteCardsAsText(data.content) : data.content;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEdit = () => {
    if (!data) return;
    setEditContent(data.content);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/formats`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: formatKey, content: editContent }),
      });
      if (!res.ok) throw new Error("Save failed");
      onGenerated(formatKey, {
        content: editContent,
        generated_at: data?.generated_at || new Date().toISOString(),
        edited: true,
      });
      setEditing(false);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const renderContent = () => {
    if (!data) return null;

    if (formatKey === "quote_cards") {
      return renderQuoteCards(data.content);
    }

    return (
      <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-6">
        {data.content}
      </p>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-medium text-gray-900">{meta.label}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{meta.description}</p>
        </div>
        {data?.edited && (
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Edited</span>
        )}
      </div>

      {/* Content area */}
      <div className="mt-3 flex-1">
        {!data && !loading && (
          <div className="flex items-center justify-center h-24 border border-dashed border-gray-200 rounded-lg">
            <button
              onClick={handleGenerate}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Generate
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-24 border border-dashed border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </div>
          </div>
        )}

        {data && !editing && renderContent()}

        {editing && (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 resize-y min-h-[120px] focus:outline-none focus:ring-1 focus:ring-gray-300"
            rows={6}
          />
        )}
      </div>

      {/* Actions */}
      {data && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={handleEdit}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Regenerate
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function renderQuoteCards(content: string) {
  let quotes: QuoteCard[];
  try {
    quotes = JSON.parse(content);
  } catch {
    return <p className="text-sm text-gray-500">Invalid quote data</p>;
  }

  if (!Array.isArray(quotes) || quotes.length === 0) {
    return <p className="text-sm text-gray-500">No quotes extracted</p>;
  }

  return (
    <div className="space-y-2">
      {quotes.map((q, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-700 italic">&ldquo;{q.text}&rdquo;</p>
          <span className="text-[10px] text-gray-400 uppercase tracking-wide mt-1 inline-block">
            {q.tag}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatQuoteCardsAsText(content: string): string {
  try {
    const quotes: QuoteCard[] = JSON.parse(content);
    return quotes.map((q) => `"${q.text}" — ${q.tag}`).join("\n\n");
  } catch {
    return content;
  }
}
