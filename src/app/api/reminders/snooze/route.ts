import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!token) {
    return NextResponse.redirect(`${appUrl}/i/snooze-confirmed?expired=1`);
  }

  const supabase = await createServiceClient();

  // Find the reminder by snooze token
  const { data: reminder, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("snooze_token", token)
    .eq("status", "sent")
    .single();

  if (error || !reminder) {
    return NextResponse.redirect(`${appUrl}/i/snooze-confirmed?expired=1`);
  }

  // Mark current reminder as snoozed
  await supabase
    .from("reminders")
    .update({ status: "snoozed" })
    .eq("id", reminder.id);

  // Push next pending reminder for this interview by +3 days
  const { data: nextReminders } = await supabase
    .from("reminders")
    .select("*")
    .eq("interview_id", reminder.interview_id)
    .eq("status", "pending")
    .order("tier", { ascending: true })
    .limit(1);

  if (nextReminders && nextReminders.length > 0) {
    const next = nextReminders[0];
    const newDate = new Date(next.scheduled_for);
    newDate.setDate(newDate.getDate() + 3);
    await supabase
      .from("reminders")
      .update({ scheduled_for: newDate.toISOString() })
      .eq("id", next.id);
  }

  return NextResponse.redirect(`${appUrl}/i/snooze-confirmed`);
}
