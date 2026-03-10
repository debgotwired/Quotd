export type ExtractionState = {
  metrics: Metric[];
  quotes: Quote[];
  facts: Facts;
  question_count: number;
};

export type Metric = {
  name: string;
  baseline: string | null;
  after: string | null;
  delta: string | null;
  unit: string;
  timeframe: string | null;
  confidence: "high" | "medium" | "low";
};

export type Quote = {
  text: string;
  tag: string;
};

export type Facts = {
  challenge?: string;
  solution?: string;
  impact?: string;
};

export type Interview = {
  id: string;
  user_id: string;
  customer_company: string;
  product_name: string;
  category: string;
  status: "draft" | "in_progress" | "completed";
  share_token: string;
  extraction_state: ExtractionState;
  draft_content?: string;
  created_at: string;
};

export type Message = {
  id: string;
  interview_id: string;
  role: "assistant" | "user";
  content: string;
  audio_url?: string | null;
  audio_path?: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  user_id: string;
  company_name: string;
  full_name: string;
  created_at: string;
  updated_at: string;
};

export type OtpToken = {
  id: string;
  email: string;
  code: string;
  expires_at: string;
  verified: boolean;
  created_at: string;
};
