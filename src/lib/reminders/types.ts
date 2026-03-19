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
