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

export type InterviewStatus =
  | "draft"
  | "in_progress"
  | "review_pending"
  | "review_in_progress"
  | "review_complete";

export type ReviewSection = {
  id: string;
  heading: string;
  status: "pending" | "approved" | "flagged";
  comment: string | null;
};

export type ReviewState = {
  sections: ReviewSection[];
  started_at: string | null;
  completed_at: string | null;
};

export type FormatKey =
  | "one_pager"
  | "linkedin"
  | "twitter"
  | "sales_slide"
  | "quote_cards"
  | "email_blurb";

export type GeneratedFormat = {
  content: string;
  generated_at: string;
  edited?: boolean;
};

export type GeneratedFormats = Partial<Record<FormatKey, GeneratedFormat>>;

export type InterviewTone = "formal" | "conversational" | "technical";
export type InterviewFocus = "balanced" | "roi" | "technical" | "storytelling";
export type TargetAudience = "general" | "c_suite" | "technical_buyer" | "end_user" | "board";

export type Interview = {
  id: string;
  user_id: string;
  customer_company: string;
  product_name: string;
  category: string;
  status: InterviewStatus;
  share_token: string;
  extraction_state: ExtractionState;
  draft_content?: string;
  review_state?: ReviewState | null;
  customer_email?: string | null;
  customer_draft_content?: string | null;
  generated_formats?: GeneratedFormats | null;
  linkedin_profile_url?: string | null;
  company_website_url?: string | null;
  interview_tone?: InterviewTone;
  interview_focus?: InterviewFocus;
  target_audience?: TargetAudience;
  question_limit?: number;
  opened_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  review_started_at?: string | null;
  review_completed_at?: string | null;
  team_id?: string | null;
  client_id?: string | null;
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
  logo_url?: string | null;
  primary_color?: string;
  welcome_message?: string | null;
  created_at: string;
  updated_at: string;
};

export type Branding = {
  logo_url: string | null;
  primary_color: string;
  welcome_message: string | null;
  company_name: string;
};

export type OtpToken = {
  id: string;
  email: string;
  code: string;
  expires_at: string;
  verified: boolean;
  created_at: string;
};

export type TeamRole = "owner" | "editor" | "viewer";

export type Team = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  invited_email: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

export type TeamInvite = {
  id: string;
  team_id: string;
  email: string;
  role: "editor" | "viewer";
  token: string;
  expires_at: string;
  created_at: string;
};

export type ReminderTier = 1 | 2 | 3;
export type ReminderStatus = "pending" | "sent" | "cancelled" | "snoozed";

export type Reminder = {
  id: string;
  interview_id: string;
  customer_email: string;
  tier: ReminderTier;
  status: ReminderStatus;
  scheduled_for: string;
  sent_at: string | null;
  snooze_token: string | null;
  ai_subject: string | null;
  ai_body: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  team_id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  welcome_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientWithStats = Client & {
  interview_count: number;
  status_breakdown: Record<string, number>;
};

export type TeamMemberWithProfile = TeamMember & {
  profile?: Pick<Profile, "full_name" | "company_name"> | null;
};

export type TeamWithMembers = Team & {
  members: TeamMemberWithProfile[];
};

export type ApiKey = {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type Webhook = {
  id: string;
  user_id: string;
  url: string;
  events: string[];
  secret: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type WebhookDelivery = {
  id: string;
  webhook_id: string;
  event: string;
  payload: object;
  status_code: number | null;
  response_body: string | null;
  attempt: number;
  delivered_at: string | null;
  created_at: string;
};
