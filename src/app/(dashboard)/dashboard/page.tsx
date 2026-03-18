import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserTeamIds } from "@/lib/teams/helpers";
import type { ExtractionState } from "@/lib/supabase/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get personal interviews
  const { data: personalInterviews } = await supabase
    .from("interviews")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  // Get team interviews
  const teamIds = await getUserTeamIds(supabase, user!.id);
  let teamInterviews: typeof personalInterviews = [];

  if (teamIds.length > 0) {
    const { data } = await supabase
      .from("interviews")
      .select("*")
      .in("team_id", teamIds)
      .neq("user_id", user!.id)
      .order("created_at", { ascending: false });
    teamInterviews = data || [];
  }

  const interviews = [
    ...(personalInterviews || []).map((i) => ({ ...i, _source: "personal" as const })),
    ...(teamInterviews || []).map((i) => ({ ...i, _source: "team" as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return "Waiting";
      case "in_progress":
        return "In progress";
      case "review_pending":
        return "Awaiting review";
      case "review_in_progress":
        return "Under review";
      case "review_complete":
        return "Review done";
      default:
        return status;
    }
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case "review_pending":
        return "bg-amber-400";
      case "review_in_progress":
        return "bg-blue-400";
      case "review_complete":
        return "bg-green-400";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Interviews</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/bulk"
            className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Bulk Create
          </Link>
          <Link
            href="/dashboard/new"
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            New
          </Link>
        </div>
      </div>

      {!interviews || interviews.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <p className="text-gray-500 mb-4">No interviews yet</p>
          <Link
            href="/dashboard/new"
            className="inline-block px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Create your first
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {interviews.map((interview) => {
            const extraction = interview.extraction_state as ExtractionState | null;
            const metricsCount = extraction?.metrics?.length || 0;
            const quotesCount = extraction?.quotes?.length || 0;

            return (
              <Link
                key={interview.id}
                href={`/dashboard/${interview.id}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors group"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${getStatusDotColor(interview.status)} shrink-0`} />
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900 group-hover:text-black">
                      {interview.customer_company}
                    </span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-gray-500 text-sm">{interview.product_name}</span>
                    {"_source" in interview && interview._source === "team" && (
                      <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">team</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-6 text-sm pl-5 sm:pl-0 shrink-0">
                  {(metricsCount > 0 || quotesCount > 0) && (
                    <span className="text-gray-400 hidden sm:inline">
                      {metricsCount > 0 && `${metricsCount} metrics`}
                      {metricsCount > 0 && quotesCount > 0 && ", "}
                      {quotesCount > 0 && `${quotesCount} quotes`}
                    </span>
                  )}
                  <span className="text-gray-500">
                    {getStatusLabel(interview.status)}
                  </span>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
