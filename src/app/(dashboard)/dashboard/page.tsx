import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ExtractionState } from "@/lib/supabase/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: interviews } = await supabase
    .from("interviews")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return "Waiting";
      case "in_progress":
        return "In progress";
      case "completed":
        return "Done";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Interviews</h1>
        <Link
          href="/dashboard/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          New
        </Link>
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
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  <div>
                    <span className="font-medium text-gray-900 group-hover:text-black">
                      {interview.customer_company}
                    </span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-gray-500 text-sm">{interview.product_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  {(metricsCount > 0 || quotesCount > 0) && (
                    <span className="text-gray-400">
                      {metricsCount > 0 && `${metricsCount} metrics`}
                      {metricsCount > 0 && quotesCount > 0 && ", "}
                      {quotesCount > 0 && `${quotesCount} quotes`}
                    </span>
                  )}
                  <span className="text-gray-500 w-20 text-right">
                    {getStatusLabel(interview.status)}
                  </span>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
