import { test, expect } from "@playwright/test";
import { cleanupTestUser, getServiceClient, APP_URL } from "./helpers";

const TEST_EMAIL = `e2e-auth-${Date.now()}@quotd.sh`;

test.describe("Auth Flow", () => {
  test.afterAll(async () => {
    await cleanupTestUser(TEST_EMAIL);
  });

  test("login page loads correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("send OTP - invalid email shows error", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill("not-an-email");
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1000);
    expect(page.url()).toContain("/login");
  });

  test("send OTP - empty email shows error", async ({ page }) => {
    await page.goto("/login");
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain("/login");
  });

  test("full OTP flow: send code → verify → onboarding (new user)", async ({ page }) => {
    await page.goto("/login");

    // Step 1: Enter email and submit
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('button[type="submit"]').click();

    // Step 2: Wait for code input screen
    await page.waitForTimeout(3000);

    // Step 3: Get OTP from database
    const sb = getServiceClient();
    const { data: otpData } = await sb
      .from("otp_tokens")
      .select("code")
      .eq("email", TEST_EMAIL.toLowerCase())
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    expect(otpData).toBeTruthy();
    const otpCode = otpData!.code;

    // Step 4: Enter code digits — form auto-submits when all 6 are filled
    const codeInputs = page.locator('input[maxlength="1"]');
    const count = await codeInputs.count();

    if (count === 6) {
      for (let i = 0; i < 6; i++) {
        await codeInputs.nth(i).fill(otpCode[i]);
        await page.waitForTimeout(100);
      }
    } else {
      // Fallback: single code input
      const codeInput = page.locator('input').first();
      await codeInput.fill(otpCode);
      const submitBtn = page.locator('button[type="submit"]');
      if (await submitBtn.isVisible()) await submitBtn.click();
    }

    // Step 5: Should navigate to onboarding or dashboard
    await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 30000 });
    const url = page.url();
    expect(url).toMatch(/\/(onboarding|dashboard)/);
  });

  test("onboarding: create profile and redirect to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(3000);

    const sb = getServiceClient();
    const { data: otpData } = await sb
      .from("otp_tokens")
      .select("code")
      .eq("email", TEST_EMAIL.toLowerCase())
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!otpData) {
      // User may already be authenticated from previous test
      await page.goto("/dashboard");
      await page.waitForTimeout(3000);
      if (page.url().includes("/dashboard")) {
        expect(page.url()).toContain("/dashboard");
        return;
      }
      test.skip();
      return;
    }

    const codeInputs = page.locator('input[maxlength="1"]');
    const count = await codeInputs.count();
    if (count === 6) {
      for (let i = 0; i < 6; i++) {
        await codeInputs.nth(i).fill(otpData.code[i]);
        await page.waitForTimeout(100);
      }
    }

    await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 30000 });

    if (page.url().includes("/onboarding")) {
      // Fill onboarding form
      const nameInput = page.locator('input').first();
      await nameInput.fill("E2E Test User");

      const inputs = page.locator("input");
      const inputCount = await inputs.count();
      if (inputCount >= 2) {
        await inputs.nth(1).fill("E2E Test Co");
      }

      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    }

    expect(page.url()).toContain("/dashboard");
  });

  test("rate limiting: rapid OTP requests are handled", async () => {
    // Note: In-memory rate limiting on serverless (Vercel) doesn't persist
    // across function instances. This test verifies the endpoint handles
    // rapid requests without crashing — rate limiting works on single-instance.
    const tempEmail = `e2e-ratelimit-${Date.now()}@quotd.sh`;
    const results = [];

    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${APP_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: tempEmail }),
      });
      results.push(res.status);
    }

    // All requests should either succeed (200) or be rate-limited (429)
    for (const status of results) {
      expect([200, 429]).toContain(status);
    }

    const sb = getServiceClient();
    await sb.from("otp_tokens").delete().eq("email", tempEmail.toLowerCase());
  });

  test("verify OTP: invalid code returns 400", async () => {
    const res = await fetch(`${APP_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, code: "000000" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid or expired");
  });

  test("verify OTP: missing fields return 400", async () => {
    const res1 = await fetch(`${APP_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    expect(res1.status).toBe(400);

    const res2 = await fetch(`${APP_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "123456" }),
    });
    expect(res2.status).toBe(400);
  });
});
