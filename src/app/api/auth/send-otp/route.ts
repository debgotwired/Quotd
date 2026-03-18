import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOtpEmail } from "@/lib/email/send";
import crypto from "crypto";

// Simple in-memory rate limiting (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3; // Max 3 OTP requests per minute per email

function generateOtp(): string {
  // Use cryptographically secure random number generation
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0);
  // Generate a 6-digit code (100000-999999)
  return String(100000 + (num % 900000));
}

function checkRateLimit(email: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = email.toLowerCase();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Check rate limit
    const rateLimit = checkRateLimit(normalizedEmail);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Please try again in ${rateLimit.retryAfter} seconds.` },
        { status: 429 }
      );
    }

    const supabase = await createServiceClient();

    // Delete any existing OTP tokens for this email
    await supabase.from("otp_tokens").delete().eq("email", normalizedEmail);

    // Opportunistic cleanup of expired tokens (~1% of requests)
    if (Math.random() < 0.01) {
      void supabase
        .from("otp_tokens")
        .delete()
        .lt("expires_at", new Date().toISOString());
    }

    // Generate new OTP using cryptographically secure method
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP token
    const { error: insertError } = await supabase.from("otp_tokens").insert({
      email: normalizedEmail,
      code,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error("Failed to store OTP:", insertError);
      return NextResponse.json(
        { error: "Failed to generate verification code" },
        { status: 500 }
      );
    }

    // Send OTP email
    await sendOtpEmail(normalizedEmail, code);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
