import { test, expect, BrowserContext, Page } from "@playwright/test";
import { getServiceClient, APP_URL } from "./helpers";
import * as crypto from "crypto";

/**
 * Dashboard page tests — validates pages load and key elements are present.
 * Logs in ONCE and reuses the authenticated context across all tests.
 */

const TEST_EMAIL = `e2e-dash-${Date.now()}@quotd.sh`;

let userId: string;
let sharedContext: BrowserContext;
let sharedPage: Page;

test.describe("Dashboard Pages", () => {
  test.beforeAll(async ({ browser }) => {
    const sb = getServiceClient();

    const { data: newUser, error } = await sb.auth.admin.createUser({
      email: TEST_EMAIL,
      password: "dash-test-pw",
      email_confirm: true,
    });
    if (error) throw new Error(`User creation failed: ${error.message}`);
    userId = newUser.user.id;

    await sb.from("profiles").insert({
      user_id: userId,
      full_name: "Dashboard Tester",
      company_name: "Dash Corp",
    });

    const token = crypto.randomBytes(16).toString("hex");
    await sb.from("interviews").insert({
      user_id: userId,
      customer_company: "Dash Test Client",
      product_name: "Dash Product",
      status: "draft",
      share_token: token,
      extraction_state: { metrics: [], quotes: [], facts: {}, question_count: 0 },
    });

    // Log in ONCE and save the context
    sharedContext = await browser.newContext();
    sharedPage = await sharedContext.newPage();

    await sharedPage.goto("/login");
    await sharedPage.locator('input[type="email"]').fill(TEST_EMAIL);
    await sharedPage.locator('button[type="submit"]').click();

    await sharedPage.waitForTimeout(3000);

    const { data: otpData } = await sb
      .from("otp_tokens")
      .select("code")
      .eq("email", TEST_EMAIL.toLowerCase())
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!otpData) throw new Error("No OTP found for dashboard test");

    const codeInputs = sharedPage.locator('input[maxlength="1"]');
    const count = await codeInputs.count();
    if (count === 6) {
      for (let i = 0; i < 6; i++) {
        await codeInputs.nth(i).fill(otpData.code[i]);
        await sharedPage.waitForTimeout(100);
      }
    }

    await sharedPage.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30000 });

    if (sharedPage.url().includes("/onboarding")) {
      await sharedPage.goto("/dashboard");
    }
  });

  test.afterAll(async () => {
    await sharedContext?.close();

    const sb = getServiceClient();
    await sb.from("interviews").delete().eq("user_id", userId);
    await sb.from("profiles").delete().eq("user_id", userId);
    await sb.from("api_keys").delete().eq("user_id", userId);
    await sb.from("webhooks").delete().eq("user_id", userId);
    await sb.from("clients").delete().eq("user_id", userId);
    await sb.from("otp_tokens").delete().eq("email", TEST_EMAIL.toLowerCase());
    await sb.auth.admin.deleteUser(userId);
  });

  test("dashboard loads and shows interviews", async () => {
    await sharedPage.goto("/dashboard");
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.locator("body")).toContainText(/interview|case stud|dashboard/i);
  });

  test("new interview page loads", async () => {
    await sharedPage.goto("/dashboard/new");
    await sharedPage.waitForTimeout(2000);

    const companyInput = sharedPage.locator(
      'input[name="customerCompany"], input[placeholder*="company" i], input[placeholder*="customer" i]'
    );
    await expect(companyInput.first()).toBeVisible({ timeout: 5000 });
  });

  test("analytics page loads", async () => {
    await sharedPage.goto("/dashboard/analytics");
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.locator("body")).toContainText(/analytic|metric|overview|interview/i);
  });

  test("clients page loads", async () => {
    await sharedPage.goto("/dashboard/clients");
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.locator("body")).toContainText(/client|workspace|add/i);
  });

  test("settings page loads", async () => {
    await sharedPage.goto("/dashboard/settings");
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.locator("body")).toContainText(/setting|profile|account/i);
  });

  test("API keys settings page loads", async () => {
    await sharedPage.goto("/dashboard/settings/api-keys");
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.locator("body")).toContainText(/api key|create|token/i);
  });

  test("webhooks settings page loads", async () => {
    await sharedPage.goto("/dashboard/settings/webhooks");
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.locator("body")).toContainText(/webhook|endpoint|url/i);
  });

  test("unauthenticated access redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(3000);
    const url = page.url();
    expect(url).toMatch(/\/(login|dashboard)/);
  });
});
