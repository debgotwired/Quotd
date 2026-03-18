import { resend, EMAIL_FROM } from "./resend";
import { OtpEmail } from "./templates/otp-email";
import { InterviewCompletedEmail } from "./templates/interview-completed-email";
import { ReviewReadyEmail } from "./templates/review-ready-email";
import { TeamInviteEmail } from "./templates/team-invite-email";

export async function sendOtpEmail(email: string, code: string) {
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `Your Quotd login code: ${code}`,
    react: OtpEmail({ code }),
  });

  if (error) {
    console.error("Failed to send OTP email:", error);
    throw new Error("Failed to send verification email");
  }
}

export async function sendInterviewCompletedEmail(
  email: string,
  customerCompany: string,
  productName: string,
  interviewId: string,
  brandColor?: string,
  logoUrl?: string | null
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const interviewUrl = `${appUrl}/dashboard/${interviewId}`;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `Interview completed: ${customerCompany} x ${productName}`,
    react: InterviewCompletedEmail({ customerCompany, productName, interviewUrl, brandColor, logoUrl }),
  });

  if (error) {
    console.error("Failed to send interview completed email:", error);
    // Don't throw - this is a notification, not critical
  }
}

export async function sendReviewReadyEmail(
  email: string,
  customerCompany: string,
  productName: string,
  reviewUrl: string,
  brandColor?: string,
  logoUrl?: string | null
) {
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `Your case study is ready for review: ${customerCompany} x ${productName}`,
    react: ReviewReadyEmail({ customerCompany, productName, reviewUrl, brandColor, logoUrl }),
  });

  if (error) {
    console.error("Failed to send review-ready email:", error);
    // Don't throw - this is a notification, not critical
  }
}

export async function sendTeamInviteEmail(
  email: string,
  teamName: string,
  inviterName: string,
  role: string,
  inviteUrl: string
) {
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `${inviterName} invited you to join ${teamName} on Quotd`,
    react: TeamInviteEmail({ teamName, inviterName, role, inviteUrl }),
  });

  if (error) {
    console.error("Failed to send team invite email:", error);
    throw new Error("Failed to send invite email");
  }
}
