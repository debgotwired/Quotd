export const WEBHOOK_EVENTS = [
  "interview.created",
  "interview.completed",
  "review.started",
  "review.completed",
  "draft.generated",
  "format.generated",
  "reminder.sent",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
