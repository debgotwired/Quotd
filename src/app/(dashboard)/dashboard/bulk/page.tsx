"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { parseCsv, type CsvInterviewRow, type CsvValidationError } from "@/lib/csv/parse";
import type { InterviewTone, InterviewFocus, TargetAudience } from "@/lib/supabase/types";

type CreatedInterview = {
  id: string;
  customer_company: string;
  product_name: string;
  customer_email: string | null;
  share_token: string;
  status: string;
};

type BulkState = "input" | "preview" | "creating" | "done";

export default function BulkCreatePage() {
  const [state, setState] = useState<BulkState>("input");
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<CsvInterviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<CsvValidationError[]>([]);
  const [createdInterviews, setCreatedInterviews] = useState<CreatedInterview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Shared defaults
  const [defaultTone, setDefaultTone] = useState<InterviewTone>("conversational");
  const [defaultFocus, setDefaultFocus] = useState<InterviewFocus>("balanced");
  const [defaultAudience, setDefaultAudience] = useState<TargetAudience>("general");
  const [defaultQuestionLimit, setDefaultQuestionLimit] = useState("15");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    setError(null);
    setParseErrors([]);

    if (!csvText.trim()) {
      setError("Please upload a CSV file or paste CSV text");
      return;
    }

    const result = parseCsv(csvText);

    if (result.errors.length > 0 && result.rows.length === 0) {
      setParseErrors(result.errors);
      return;
    }

    if (result.rows.length === 0) {
      setError("No valid rows found in CSV");
      return;
    }

    setParsedRows(result.rows);
    setParseErrors(result.errors);
    setState("preview");
  };

  const handleCreate = async () => {
    setState("creating");
    setError(null);

    // Apply shared defaults to rows that don't have overrides
    const interviews = parsedRows.map((row) => ({
      ...row,
      interview_tone: row.interview_tone || defaultTone,
      interview_focus: row.interview_focus || defaultFocus,
      target_audience: row.target_audience || defaultAudience,
      question_limit: row.question_limit || parseInt(defaultQuestionLimit, 10),
    }));

    try {
      const response = await fetch("/api/interviews/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviews }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create interviews");
        setState("preview");
        return;
      }

      setCreatedInterviews(data.interviews);
      setState("done");
    } catch {
      setError("Network error. Please try again.");
      setState("preview");
    }
  };

  const getShareLink = (token: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/i/${token}`;
    }
    return `/i/${token}`;
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadLinksAsCsv = () => {
    const header = "customer_company,product_name,customer_email,share_link";
    const rows = createdInterviews.map(
      (i) =>
        `"${i.customer_company.replace(/"/g, '""')}","${i.product_name.replace(/"/g, '""')}","${(i.customer_email || "").replace(/"/g, '""')}","${getShareLink(i.share_token)}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "interview-links.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAllLinks = async () => {
    const links = createdInterviews
      .map((i) => `${i.customer_company}: ${getShareLink(i.share_token)}`)
      .join("\n");
    await navigator.clipboard.writeText(links);
    setCopiedId("all");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
        &larr; Back
      </Link>

      <div className="mt-8">
        <h1 className="text-2xl font-semibold text-gray-900">Bulk Create</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload a CSV to create multiple interviews at once
        </p>
      </div>

      {error && (
        <div className="mt-6 p-3 text-sm text-gray-700 bg-gray-100 rounded-lg border border-gray-200">
          {error}
        </div>
      )}

      {/* INPUT STATE */}
      {state === "input" && (
        <div className="mt-8 space-y-6">
          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload CSV file
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
            >
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-500">Click to upload CSV</p>
              <p className="text-xs text-gray-400 mt-1">or paste CSV text below</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Or paste */}
          <div>
            <label htmlFor="csvText" className="block text-sm font-medium text-gray-700 mb-2">
              Or paste CSV text
            </label>
            <textarea
              id="csvText"
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`customer_company,product_name,customer_email\nAcme Corp,Quotd,alice@acme.com\nGlobex Inc,Quotd,bob@globex.com`}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors font-mono text-sm"
            />
          </div>

          {/* Column guide */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Expected columns</p>
            <div className="text-xs text-gray-500 space-y-1">
              <p><span className="font-medium text-gray-700">customer_company</span> (required) — the customer&apos;s company name</p>
              <p><span className="font-medium text-gray-700">product_name</span> (required) — your product name</p>
              <p><span className="text-gray-600">customer_email</span> — customer&apos;s email for notifications</p>
              <p><span className="text-gray-600">linkedin_profile_url</span> — interviewee&apos;s LinkedIn</p>
              <p><span className="text-gray-600">company_website_url</span> — customer&apos;s website</p>
              <p><span className="text-gray-600">interview_tone</span> — conversational, formal, or technical</p>
              <p><span className="text-gray-600">interview_focus</span> — balanced, roi, technical, or storytelling</p>
              <p><span className="text-gray-600">target_audience</span> — general, c_suite, technical_buyer, end_user, or board</p>
              <p><span className="text-gray-600">question_limit</span> — number between 5 and 30</p>
            </div>
          </div>

          {/* Parse errors */}
          {parseErrors.length > 0 && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm font-medium text-red-800 mb-2">CSV errors</p>
              <div className="space-y-1">
                {parseErrors.map((err, i) => (
                  <p key={i} className="text-xs text-red-700">
                    Row {err.row}: {err.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleParse}
            className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Preview
          </button>
        </div>
      )}

      {/* PREVIEW STATE */}
      {state === "preview" && (
        <div className="mt-8 space-y-6">
          {/* Shared settings */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Default settings <span className="text-gray-400 font-normal">(applied when not specified per-row)</span>
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="defaultTone" className="block text-xs text-gray-600 mb-1">Tone</label>
                <select
                  id="defaultTone"
                  value={defaultTone}
                  onChange={(e) => setDefaultTone(e.target.value as InterviewTone)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  <option value="conversational">Conversational</option>
                  <option value="formal">Formal</option>
                  <option value="technical">Technical</option>
                </select>
              </div>

              <div>
                <label htmlFor="defaultFocus" className="block text-xs text-gray-600 mb-1">Focus</label>
                <select
                  id="defaultFocus"
                  value={defaultFocus}
                  onChange={(e) => setDefaultFocus(e.target.value as InterviewFocus)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  <option value="balanced">Balanced</option>
                  <option value="roi">ROI-heavy</option>
                  <option value="technical">Technical depth</option>
                  <option value="storytelling">Emotional storytelling</option>
                </select>
              </div>

              <div>
                <label htmlFor="defaultAudience" className="block text-xs text-gray-600 mb-1">Audience</label>
                <select
                  id="defaultAudience"
                  value={defaultAudience}
                  onChange={(e) => setDefaultAudience(e.target.value as TargetAudience)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  <option value="general">General</option>
                  <option value="c_suite">C-suite</option>
                  <option value="technical_buyer">Technical buyer</option>
                  <option value="end_user">End user</option>
                  <option value="board">Board / investors</option>
                </select>
              </div>

              <div>
                <label htmlFor="defaultQuestionLimit" className="block text-xs text-gray-600 mb-1">Questions</label>
                <select
                  id="defaultQuestionLimit"
                  value={defaultQuestionLimit}
                  onChange={(e) => setDefaultQuestionLimit(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  <option value="10">~10 (quick)</option>
                  <option value="15">~15 (standard)</option>
                  <option value="20">~20 (deep dive)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Parse warnings */}
          {parseErrors.length > 0 && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs font-medium text-amber-800 mb-1">
                {parseErrors.length} row{parseErrors.length > 1 ? "s" : ""} skipped due to errors
              </p>
              <div className="space-y-0.5">
                {parseErrors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-xs text-amber-700">
                    Row {err.row}: {err.message}
                  </p>
                ))}
                {parseErrors.length > 5 && (
                  <p className="text-xs text-amber-600">
                    ...and {parseErrors.length - 5} more
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Company</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Overrides</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => {
                    const overrides: string[] = [];
                    if (row.interview_tone) overrides.push(row.interview_tone);
                    if (row.interview_focus) overrides.push(row.interview_focus);
                    if (row.target_audience) overrides.push(row.target_audience);
                    if (row.question_limit) overrides.push(`${row.question_limit}q`);

                    return (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2.5 text-gray-900 font-medium">{row.customer_company}</td>
                        <td className="px-4 py-2.5 text-gray-600">{row.product_name}</td>
                        <td className="px-4 py-2.5 text-gray-500">{row.customer_email || "—"}</td>
                        <td className="px-4 py-2.5">
                          {overrides.length > 0 ? (
                            <span className="text-xs text-gray-500">{overrides.join(", ")}</span>
                          ) : (
                            <span className="text-xs text-gray-300">defaults</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            {parsedRows.length} interview{parsedRows.length !== 1 ? "s" : ""} will be created
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => { setState("input"); setParsedRows([]); }}
              className="flex-1 py-3 px-4 bg-white text-gray-700 font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              className="flex-1 py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Create All
            </button>
          </div>
        </div>
      )}

      {/* CREATING STATE */}
      {state === "creating" && (
        <div className="mt-16 text-center">
          <div className="inline-block w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          <p className="text-gray-500 mt-4">Creating {parsedRows.length} interviews...</p>
        </div>
      )}

      {/* DONE STATE */}
      {state === "done" && (
        <div className="mt-8 space-y-6">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-900">
              {createdInterviews.length} interview{createdInterviews.length !== 1 ? "s" : ""} created
            </p>
            <p className="text-xs text-gray-500 mt-1">Share the links below with your customers</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={copyAllLinks}
              className="flex-1 py-2.5 px-4 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              {copiedId === "all" ? "Copied!" : "Copy all links"}
            </button>
            <button
              onClick={downloadLinksAsCsv}
              className="flex-1 py-2.5 px-4 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Download CSV
            </button>
          </div>

          {/* Results table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Company</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Link</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {createdInterviews.map((interview) => (
                    <tr key={interview.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="text-gray-900 font-medium">{interview.customer_company}</span>
                        {interview.customer_email && (
                          <span className="text-gray-400 text-xs ml-2">{interview.customer_email}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-gray-500 text-xs font-mono truncate block max-w-xs">
                          {getShareLink(interview.share_token)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => copyToClipboard(getShareLink(interview.share_token), interview.id)}
                          className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                        >
                          {copiedId === interview.id ? "Copied" : "Copy"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="block w-full py-3 px-4 bg-gray-900 text-white text-center font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
