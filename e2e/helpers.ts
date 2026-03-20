import { createClient } from "@supabase/supabase-js";

// Service client — full admin access for test setup/teardown
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const TEST_EMAIL = `e2e-test-${Date.now()}@quotd.sh`;
export const APP_URL = "https://app.quotd.sh";

/**
 * Send OTP via the API and return the code from the DB
 */
export async function sendAndGetOTP(email: string): Promise<string> {
  const res = await fetch(`${APP_URL}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`send-otp failed (${res.status}): ${body}`);
  }

  // Read code from DB via service client
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("otp_tokens")
    .select("code")
    .eq("email", email.toLowerCase())
    .eq("verified", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) throw new Error(`OTP not found in DB: ${error?.message}`);
  return data.code;
}

/**
 * Verify OTP via the API and return cookies
 */
export async function verifyOTP(
  email: string,
  code: string
): Promise<{ cookies: string[]; needsOnboarding: boolean }> {
  const res = await fetch(`${APP_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
    redirect: "manual",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`verify-otp failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const setCookies = res.headers.getSetCookie?.() || [];
  return { cookies: setCookies, needsOnboarding: json.needsOnboarding };
}

/**
 * Clean up test data for a given email
 */
export async function cleanupTestUser(email: string) {
  const sb = getServiceClient();
  const normalizedEmail = email.toLowerCase();

  // Find user
  let userId: string | null = null;
  let page = 1;
  while (!userId) {
    const {
      data: { users },
    } = await sb.auth.admin.listUsers({ page, perPage: 100 });
    if (!users || users.length === 0) break;
    const found = users.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (found) {
      userId = found.id;
      break;
    }
    if (users.length < 100) break;
    page++;
  }

  if (userId) {
    // Delete interviews (cascades to messages, reminders, etc.)
    await sb.from("interviews").delete().eq("user_id", userId);
    // Delete profile
    await sb.from("profiles").delete().eq("user_id", userId);
    // Delete api_keys
    await sb.from("api_keys").delete().eq("user_id", userId);
    // Delete webhooks
    await sb.from("webhooks").delete().eq("user_id", userId);
    // Delete clients
    await sb.from("clients").delete().eq("user_id", userId);
    // Delete auth user
    await sb.auth.admin.deleteUser(userId);
  }

  // Delete OTP tokens
  await sb.from("otp_tokens").delete().eq("email", normalizedEmail);
}
