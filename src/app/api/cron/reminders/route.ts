import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateReminderContent } from "@/lib/reminders/generate";
import { generateSnoozeToken, buildSnoozeUrl } from "@/lib/reminders/snooze";
import { getBrandingForInterview } from "@/lib/branding/get-branding";
import { resend, EMAIL_FROM } from "@/lib/email/resend";
import { ReminderEmail } from "@/lib/email/templates/reminder-email";
import type { ExtractionState } from "@/lib/supabase/types";
import type { Reminder } from "@/lib/reminders/types";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  const { data: dueReminders, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true });

  if (error || !dueReminders) {
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }

  const results: { id: string; status: string }[] = [];

  for (const reminder of dueReminders as Reminder[]) {
    try {
      const { data: interview } = await supabase
        .from("interviews")
        .select("id, user_id, customer_company, product_name, extraction_state, share_token, status, client_id")
        .eq("id", reminder.interview_id)
        .single();

      if (!interview) {
        results.push({ id: reminder.id, status: "skipped_no_interview" });
        continue;
      }

      // Auto-cancel if review is already complete
      if (interview.status === "review_complete") {
        await supabase
          .from("reminders")
          .update({ status: "cancelled" })
          .eq("id", reminder.id);
        results.push({ id: reminder.id, status: "cancelled_review_complete" });
        continue;
      }

      const extractionState = interview.extraction_state as ExtractionState;
      const branding = await getBrandingForInterview(supabase, interview.user_id, interview.client_id);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const reviewUrl = `${appUrl}/i/${interview.share_token}/review`;

      // Generate AI content
      const content = await generateReminderContent(
        interview.customer_company,
        interview.product_name,
        extractionState,
        reminder.tier
      );

      // Generate snooze token
      const snoozeToken = generateSnoozeToken();
      const snoozeUrl = buildSnoozeUrl(snoozeToken);

      // Determine recipient: tier 3 goes to creator, others to customer
      let recipientEmail = reminder.customer_email;
      if (reminder.tier === 3) {
        const { data: userData } = await supabase.auth.admin.getUserById(
          interview.user_id
        );
        if (userData?.user?.email) {
          recipientEmail = userData.user.email;
        }
      }

      // Send email
      const { error: sendError } = await resend.emails.send({
        from: EMAIL_FROM,
        to: recipientEmail,
        subject: content.subject,
        react: ReminderEmail({
          subject: content.subject,
          body: content.body,
          reviewUrl,
          snoozeUrl,
          brandColor: branding.primary_color,
          logoUrl: branding.logo_url,
        }),
      });

      if (sendError) {
        console.error(`Failed to send reminder ${reminder.id}:`, sendError);
        results.push({ id: reminder.id, status: "send_failed" });
        continue;
      }

      // Update reminder as sent
      await supabase
        .from("reminders")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          snooze_token: snoozeToken,
          ai_subject: content.subject,
          ai_body: content.body,
        })
        .eq("id", reminder.id);

      results.push({ id: reminder.id, status: "sent" });
    } catch (err) {
      console.error(`Error processing reminder ${reminder.id}:`, err);
      results.push({ id: reminder.id, status: "error" });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
