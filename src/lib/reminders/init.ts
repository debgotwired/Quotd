import { createServiceClient } from "@/lib/supabase/server";

const TIER_OFFSETS_DAYS = [2, 5, 8] as const;

export async function initReminders(
  interviewId: string,
  customerEmail: string
): Promise<void> {
  const supabase = await createServiceClient();
  const now = new Date();

  const rows = TIER_OFFSETS_DAYS.map((days, i) => {
    const scheduledFor = new Date(now);
    scheduledFor.setDate(scheduledFor.getDate() + days);
    return {
      interview_id: interviewId,
      customer_email: customerEmail,
      tier: (i + 1) as 1 | 2 | 3,
      status: "pending" as const,
      scheduled_for: scheduledFor.toISOString(),
    };
  });

  const { error } = await supabase.from("reminders").insert(rows);
  if (error) {
    console.error("Failed to schedule reminders:", error);
  }
}

export async function cancelReminders(interviewId: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("reminders")
    .update({ status: "cancelled" })
    .eq("interview_id", interviewId)
    .eq("status", "pending");

  if (error) {
    console.error("Failed to cancel reminders:", error);
  }
}
