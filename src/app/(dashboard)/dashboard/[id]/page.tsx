import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CopyButton } from "./copy-button";
import { ExportButtons } from "./export-buttons";
import { TranscriptToggle } from "./transcript-toggle";
import { MarkdownContent } from "./markdown-content";
import type { ExtractionState, Message } from "@/lib/supabase/types";

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !interview) {
    notFound();
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("interview_id", id)
    .order("created_at", { ascending: true });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const shareUrl = `${baseUrl}/i/${interview.share_token}`;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return "Waiting for response";
      case "in_progress":
        return "In progress";
      case "completed":
        return "Completed";
      default:
        return status;
    }
  };

  const extractionState = interview.extraction_state as ExtractionState | null;
  const hasResults = (extractionState?.metrics?.length || 0) > 0 ||
                     (extractionState?.quotes?.length || 0) > 0 ||
                     interview.draft_content;

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          &larr; Back
        </Link>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{interview.customer_company}</h1>
            <p className="text-gray-500 text-sm mt-1">{interview.product_name}</p>
          </div>
          <span className="text-sm text-gray-500">{getStatusLabel(interview.status)}</span>
        </div>
      </div>

      {/* Share Link - Prominent */}
      <div className="bg-gray-100 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Interview link</span>
          <CopyButton text={shareUrl} />
        </div>
        <code className="block text-sm text-gray-600 break-all font-mono">{shareUrl}</code>
      </div>

      {/* Results Section */}
      {hasResults ? (
        <div className="space-y-8">
          {/* Generated Draft - Front and Center */}
          {interview.draft_content && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Case Study Draft</h2>
                <div className="flex items-center gap-4">
                  <ExportButtons interviewId={interview.id} />
                  <CopyButton text={interview.draft_content} label="Copy" />
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8">
                <MarkdownContent content={interview.draft_content} />
              </div>
            </div>
          )}

          {/* Metrics as Cards */}
          {extractionState?.metrics && extractionState.metrics.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Metrics</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {extractionState.metrics.map((metric, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-sm text-gray-500 mb-2">{metric.name}</p>
                    <div className="flex items-baseline gap-2">
                      {metric.delta && (
                        <span className="text-2xl font-semibold text-gray-900">
                          {metric.delta}{metric.unit && <span className="text-lg text-gray-500 ml-1">{metric.unit}</span>}
                        </span>
                      )}
                    </div>
                    {(metric.baseline || metric.after) && (
                      <p className="text-xs text-gray-400 mt-2">
                        {metric.baseline && `${metric.baseline}`}
                        {metric.baseline && metric.after && " → "}
                        {metric.after && `${metric.after}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quotes */}
          {extractionState?.quotes && extractionState.quotes.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quotes</h2>
              <div className="space-y-4">
                {extractionState.quotes.map((quote, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-gray-700 leading-relaxed">&ldquo;{quote.text}&rdquo;</p>
                    <p className="text-xs text-gray-400 mt-3">{quote.tag}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Facts */}
          {extractionState?.facts && (extractionState.facts.challenge || extractionState.facts.solution || extractionState.facts.impact) && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Facts</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {extractionState.facts.challenge && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Challenge</p>
                    <p className="text-sm text-gray-700">{extractionState.facts.challenge}</p>
                  </div>
                )}
                {extractionState.facts.solution && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Solution</p>
                    <p className="text-sm text-gray-700">{extractionState.facts.solution}</p>
                  </div>
                )}
                {extractionState.facts.impact && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Impact</p>
                    <p className="text-sm text-gray-700">{extractionState.facts.impact}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <p className="text-gray-500">No results yet. Share the link with your customer to start the interview.</p>
        </div>
      )}

      {/* Transcript - Collapsible */}
      {messages && messages.length > 0 && (
        <TranscriptToggle messages={messages as Message[]} />
      )}
    </div>
  );
}
