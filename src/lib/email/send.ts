import { resend, EMAIL_FROM } from "./resend";
import { OtpEmail } from "./templates/otp-email";
import { InterviewCompletedEmail } from "./templates/interview-completed-email";

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
  interviewId: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const interviewUrl = `${appUrl}/dashboard/interviews/${interviewId}`;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `Interview completed: ${customerCompany} x ${productName}`,
    react: InterviewCompletedEmail({ customerCompany, productName, interviewUrl }),
  });

  if (error) {
    console.error("Failed to send interview completed email:", error);
    // Don't throw - this is a notification, not critical
  }
}
