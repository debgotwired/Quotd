import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Failed attempt tracking (use Redis in production)
const failedAttempts = new Map<string, { count: number; lockoutUntil?: number }>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Rate limiting for verify attempts
const verifyRateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_VERIFY_REQUESTS = 10; // Max 10 verify attempts per minute

const USER_PASSWORD_PREFIX = "qtd_";

function generateUserPassword(email: string): string {
  const crypto = require("crypto");
  const secret = process.env.OTP_PASSWORD_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback";
  const hmac = crypto.createHmac("sha256", secret).update(email.toLowerCase()).digest("hex");
  return USER_PASSWORD_PREFIX + hmac; // 4 + 64 = 68 chars (under bcrypt 72 limit)
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = verifyRateLimit.get(ip);

  if (!record || now > record.resetTime) {
    verifyRateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  if (record.count >= MAX_VERIFY_REQUESTS) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
}

function checkLockout(email: string): { locked: boolean; retryAfter?: number } {
  const record = failedAttempts.get(email.toLowerCase());
  if (!record) return { locked: false };

  const now = Date.now();
  if (record.lockoutUntil && now < record.lockoutUntil) {
    return { locked: true, retryAfter: Math.ceil((record.lockoutUntil - now) / 1000) };
  }

  // Reset if lockout expired
  if (record.lockoutUntil && now >= record.lockoutUntil) {
    failedAttempts.delete(email.toLowerCase());
  }

  return { locked: false };
}

function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase();
  const record = failedAttempts.get(key) || { count: 0 };
  record.count++;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockoutUntil = Date.now() + LOCKOUT_DURATION;
  }

  failedAttempts.set(key, record);
}

function clearFailedAttempts(email: string): void {
  failedAttempts.delete(email.toLowerCase());
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ||
               request.headers.get("x-real-ip") ||
               "unknown";

    // Check rate limit
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${rateLimit.retryAfter} seconds.` },
        { status: 429 }
      );
    }

    const { email, code } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = code.trim();

    // Check if email is locked out
    const lockout = checkLockout(normalizedEmail);
    if (lockout.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Please try again in ${lockout.retryAfter} seconds.` },
        { status: 429 }
      );
    }

    const serviceClient = await createServiceClient();

    // Find valid OTP token
    const { data: otpToken, error: otpError } = await serviceClient
      .from("otp_tokens")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("code", normalizedCode)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (otpError || !otpToken) {
      recordFailedAttempt(normalizedEmail);
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 400 }
      );
    }

    // Clear failed attempts on successful verification
    clearFailedAttempts(normalizedEmail);

    let userId: string;
    let isNewUser = false;
    const userPassword = generateUserPassword(normalizedEmail);

    // Try to create user first (avoids scanning all users in the new-user case)
    const { data: newUser, error: createError } =
      await serviceClient.auth.admin.createUser({
        email: normalizedEmail,
        password: userPassword,
        email_confirm: true,
      });

    if (!createError && newUser.user) {
      userId = newUser.user.id;
      isNewUser = true;
    } else {
      // User already exists — find them by paginating (handles any user count)
      let existingUser = null;
      let page = 1;
      const perPage = 100;
      while (!existingUser) {
        const { data: { users } } = await serviceClient.auth.admin.listUsers({ page, perPage });
        if (!users || users.length === 0) break;
        existingUser = users.find((u) => u.email?.toLowerCase() === normalizedEmail);
        if (users.length < perPage) break; // last page
        page++;
      }

      if (!existingUser) {
        console.error("User creation failed and user not found:", createError);
        return NextResponse.json(
          { error: "Failed to create account. Please try again." },
          { status: 500 }
        );
      }

      userId = existingUser.id;
      // Update password to ensure we can sign in
      await serviceClient.auth.admin.updateUserById(userId, {
        password: userPassword,
      });
    }

    // Mark OTP as verified AFTER user creation succeeds
    await serviceClient
      .from("otp_tokens")
      .update({ verified: true })
      .eq("id", otpToken.id);

    // Now sign in the user using the regular client with cookies
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: userPassword,
    });

    if (signInError) {
      console.error("Failed to sign in:", signInError);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    // Check if user has a profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    const needsOnboarding = isNewUser || !profile;

    return NextResponse.json({
      success: true,
      needsOnboarding,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Failed to verify code" },
      { status: 500 }
    );
  }
}
