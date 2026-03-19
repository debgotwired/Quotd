import crypto from "crypto";

export function generateSnoozeToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function buildSnoozeUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl}/api/reminders/snooze?token=${token}`;
}
