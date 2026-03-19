export type FunnelData = {
  created: number;
  opened: number;
  started: number;
  completed: number;
  review_started: number;
  review_completed: number;
};

export type ConversionRates = {
  created_to_opened: number;
  opened_to_started: number;
  started_to_completed: number;
  completed_to_review_started: number;
  review_started_to_completed: number;
  overall: number;
};

export type QuestionDropoff = {
  question_number: number;
  count: number;
};

export type TimeStats = {
  median_interview_minutes: number | null;
  median_review_minutes: number | null;
  median_total_minutes: number | null;
};

export type TrendPoint = {
  period: string;
  created: number;
  completed: number;
  review_completed: number;
};

export type InterviewRow = {
  id: string;
  customer_company: string;
  product_name: string;
  status: string;
  created_at: string;
  opened_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  review_started_at: string | null;
  review_completed_at: string | null;
  question_count: number;
};

export type AnalyticsResponse = {
  funnel: FunnelData;
  conversion_rates: ConversionRates;
  question_dropoff: QuestionDropoff[];
  time_stats: TimeStats;
  trends: TrendPoint[];
  interviews: InterviewRow[];
};
