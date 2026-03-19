import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTeamIds } from "@/lib/teams/helpers";
import type { ExtractionState } from "@/lib/supabase/types";
import type {
  FunnelData,
  ConversionRates,
  QuestionDropoff,
  TimeStats,
  TrendPoint,
  InterviewRow,
  AnalyticsResponse,
} from "@/lib/analytics/types";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  // Get Monday of the week
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = request.nextUrl.searchParams.get("period") || "30d";

  // Calculate date filter
  let dateFilter: string | null = null;
  if (period !== "all") {
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    dateFilter = cutoff.toISOString();
  }

  // Get personal interviews
  let personalQuery = supabase
    .from("interviews")
    .select(
      "id, customer_company, product_name, status, created_at, opened_at, started_at, completed_at, review_started_at, review_completed_at, extraction_state"
    )
    .eq("user_id", user.id);

  if (dateFilter) {
    personalQuery = personalQuery.gte("created_at", dateFilter);
  }

  const { data: personalInterviews } = await personalQuery.order("created_at", {
    ascending: false,
  });

  // Get team interviews (same pattern as dashboard page)
  const teamIds = await getUserTeamIds(supabase, user.id);
  let teamInterviews: typeof personalInterviews = [];

  if (teamIds.length > 0) {
    let teamQuery = supabase
      .from("interviews")
      .select(
        "id, customer_company, product_name, status, created_at, opened_at, started_at, completed_at, review_started_at, review_completed_at, extraction_state"
      )
      .in("team_id", teamIds)
      .neq("user_id", user.id);

    if (dateFilter) {
      teamQuery = teamQuery.gte("created_at", dateFilter);
    }

    const { data } = await teamQuery.order("created_at", { ascending: false });
    teamInterviews = data || [];
  }

  const allInterviews = [...(personalInterviews || []), ...(teamInterviews || [])];

  // --- Funnel ---
  const funnel: FunnelData = {
    created: allInterviews.length,
    opened: allInterviews.filter((i) => i.opened_at).length,
    started: allInterviews.filter((i) => i.started_at).length,
    completed: allInterviews.filter((i) => i.completed_at).length,
    review_started: allInterviews.filter((i) => i.review_started_at).length,
    review_completed: allInterviews.filter((i) => i.review_completed_at).length,
  };

  // --- Conversion rates ---
  const conversion_rates: ConversionRates = {
    created_to_opened: rate(funnel.opened, funnel.created),
    opened_to_started: rate(funnel.started, funnel.opened),
    started_to_completed: rate(funnel.completed, funnel.started),
    completed_to_review_started: rate(funnel.review_started, funnel.completed),
    review_started_to_completed: rate(funnel.review_completed, funnel.review_started),
    overall: rate(funnel.review_completed, funnel.created),
  };

  // --- Question dropoff ---
  const questionCounts: Record<number, number> = {};
  for (const interview of allInterviews) {
    const extraction = interview.extraction_state as ExtractionState | null;
    const count = extraction?.question_count || 0;
    if (count > 0) {
      for (let q = 1; q <= count; q++) {
        questionCounts[q] = (questionCounts[q] || 0) + 1;
      }
    }
  }

  const question_dropoff: QuestionDropoff[] = Object.entries(questionCounts)
    .map(([num, count]) => ({ question_number: Number(num), count }))
    .sort((a, b) => a.question_number - b.question_number);

  // --- Time stats ---
  const interviewDurations: number[] = [];
  const reviewDurations: number[] = [];
  const totalDurations: number[] = [];

  for (const interview of allInterviews) {
    if (interview.started_at && interview.completed_at) {
      const mins =
        (new Date(interview.completed_at).getTime() -
          new Date(interview.started_at).getTime()) /
        60000;
      if (mins > 0) interviewDurations.push(mins);
    }
    if (interview.review_started_at && interview.review_completed_at) {
      const mins =
        (new Date(interview.review_completed_at).getTime() -
          new Date(interview.review_started_at).getTime()) /
        60000;
      if (mins > 0) reviewDurations.push(mins);
    }
    if (interview.started_at && interview.review_completed_at) {
      const mins =
        (new Date(interview.review_completed_at).getTime() -
          new Date(interview.started_at).getTime()) /
        60000;
      if (mins > 0) totalDurations.push(mins);
    }
  }

  const time_stats: TimeStats = {
    median_interview_minutes: median(interviewDurations),
    median_review_minutes: median(reviewDurations),
    median_total_minutes: median(totalDurations),
  };

  // --- Trends (weekly) ---
  const weeklyBuckets: Record<
    string,
    { created: number; completed: number; review_completed: number }
  > = {};

  for (const interview of allInterviews) {
    const week = getWeekKey(new Date(interview.created_at));
    if (!weeklyBuckets[week]) {
      weeklyBuckets[week] = { created: 0, completed: 0, review_completed: 0 };
    }
    weeklyBuckets[week].created++;

    if (interview.completed_at) {
      const cWeek = getWeekKey(new Date(interview.completed_at));
      if (!weeklyBuckets[cWeek]) {
        weeklyBuckets[cWeek] = { created: 0, completed: 0, review_completed: 0 };
      }
      weeklyBuckets[cWeek].completed++;
    }

    if (interview.review_completed_at) {
      const rWeek = getWeekKey(new Date(interview.review_completed_at));
      if (!weeklyBuckets[rWeek]) {
        weeklyBuckets[rWeek] = { created: 0, completed: 0, review_completed: 0 };
      }
      weeklyBuckets[rWeek].review_completed++;
    }
  }

  const trends: TrendPoint[] = Object.entries(weeklyBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, data]) => ({ period, ...data }));

  // --- Interview rows ---
  const interviews: InterviewRow[] = allInterviews.map((i) => ({
    id: i.id,
    customer_company: i.customer_company,
    product_name: i.product_name,
    status: i.status,
    created_at: i.created_at,
    opened_at: i.opened_at,
    started_at: i.started_at,
    completed_at: i.completed_at,
    review_started_at: i.review_started_at,
    review_completed_at: i.review_completed_at,
    question_count: (i.extraction_state as ExtractionState | null)?.question_count || 0,
  }));

  const response: AnalyticsResponse = {
    funnel,
    conversion_rates,
    question_dropoff,
    time_stats,
    trends,
    interviews,
  };

  return NextResponse.json(response);
}
