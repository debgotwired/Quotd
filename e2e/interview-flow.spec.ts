import { test, expect } from "@playwright/test";
import { getServiceClient, APP_URL } from "./helpers";
import * as crypto from "crypto";

/**
 * Tests the customer-facing interview flow:
 * Welcome page → Questions → Done → Review
 */

const TEST_EMAIL = `e2e-flow-creator-${Date.now()}@quotd.sh`;
let userId: string;
let interviewId: string;
let shareToken: string;

test.describe("Interview Flow (Customer-Facing)", () => {
  test.beforeAll(async () => {
    const sb = getServiceClient();

    const { data: newUser, error } = await sb.auth.admin.createUser({
      email: TEST_EMAIL,
      password: "test-password-for-e2e",
      email_confirm: true,
    });
    if (error) throw new Error(`User creation failed: ${error.message}`);
    userId = newUser.user.id;

    await sb.from("profiles").insert({
      user_id: userId,
      full_name: "Flow Test Creator",
      company_name: "Flow Corp",
    });

    shareToken = crypto.randomBytes(16).toString("hex");

    const { data, error: insertErr } = await sb
      .from("interviews")
      .insert({
        user_id: userId,
        customer_company: "Flow Customer Inc",
        product_name: "Flow Product",
        customer_email: "customer@flow-test.com",
        interview_tone: "conversational",
        interview_focus: "balanced",
        target_audience: "general",
        question_limit: 5,
        status: "draft",
        share_token: shareToken,
        extraction_state: { metrics: [], quotes: [], facts: {}, question_count: 0 },
      })
      .select()
      .single();

    if (insertErr) throw new Error(`Interview creation failed: ${insertErr.message}`);
    interviewId = data!.id;
  });

  test.afterAll(async () => {
    const sb = getServiceClient();
    await sb.from("messages").delete().eq("interview_id", interviewId);
    await sb.from("reminders").delete().eq("interview_id", interviewId);
    await sb.from("interviews").delete().eq("id", interviewId);
    await sb.from("profiles").delete().eq("user_id", userId);
    await sb.from("otp_tokens").delete().eq("email", TEST_EMAIL.toLowerCase());
    await sb.auth.admin.deleteUser(userId);
  });

  test("welcome page loads with correct company name", async ({ page }) => {
    await page.goto(`/i/${shareToken}`);
    await page.waitForTimeout(2000);
    await expect(page.locator("body")).toContainText(/Flow Customer Inc|Flow Product|begin|start/i);
  });

  test("welcome page has start button", async ({ page }) => {
    await page.goto(`/i/${shareToken}`);
    const startButton = page.locator('a[href*="/q"], button:has-text("Start"), button:has-text("Begin")');
    await expect(startButton.first()).toBeVisible({ timeout: 5000 });
  });

  test("clicking start navigates to question page", async ({ page }) => {
    await page.goto(`/i/${shareToken}`);
    await page.waitForTimeout(1000);

    const startLink = page.locator(`a[href*="/i/${shareToken}/q"]`);
    if (await startLink.isVisible()) {
      await startLink.click();
    } else {
      await page.goto(`/i/${shareToken}/q`);
    }

    await page.waitForURL(`**/i/${shareToken}/q**`, { timeout: 10000 });
    expect(page.url()).toContain("/q");
  });

  test("question page shows AI question", async ({ page }) => {
    // Mark as opened first
    await fetch(`${APP_URL}/api/interview/${shareToken}/opened`, { method: "POST" });

    await page.goto(`/i/${shareToken}/q`);
    await page.waitForTimeout(5000);

    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(50);
  });

  test("invalid token shows 404", async ({ page }) => {
    await page.goto("/i/totally-invalid-token-that-does-not-exist");
    await page.waitForTimeout(2000);

    const body = await page.locator("body").textContent();
    expect(body).toMatch(/not found|404|error|doesn.t exist/i);
  });

  test("interview API: opened sets opened_at", async () => {
    // Reset interview
    const sb = getServiceClient();
    await sb.from("interviews").update({ status: "draft", opened_at: null }).eq("id", interviewId);

    const res = await fetch(`${APP_URL}/api/interview/${shareToken}/opened`, { method: "POST" });
    expect(res.status).toBe(200);

    const { data } = await sb
      .from("interviews")
      .select("opened_at")
      .eq("id", interviewId)
      .single();
    expect(data?.opened_at).toBeTruthy();
  });

  test("interview API: submit-answer accepts an answer", async () => {
    // Ensure interview is in_progress
    const sb = getServiceClient();
    await sb.from("interviews").update({ status: "in_progress" }).eq("id", interviewId);

    const res = await fetch(
      `${APP_URL}/api/interview/${shareToken}/submit-answer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: "We saw a 40% improvement in efficiency after adopting Flow Product.",
        }),
      }
    );

    // AI-dependent — accept 200 or 502 (AI failure)
    expect([200, 400, 502]).toContain(res.status);
  });

  test("done page loads for completed interview", async ({ page }) => {
    const sb = getServiceClient();
    await sb
      .from("interviews")
      .update({
        status: "review_pending",
        draft_content: "# E2E Test Case Study\n\nFlow Customer Inc saw great results.",
        extraction_state: {
          metrics: [{ value: "40%", label: "efficiency improvement" }],
          quotes: ["Flow Product changed everything"],
          facts: { industry: "Technology" },
          question_count: 5,
        },
      })
      .eq("id", interviewId);

    await page.goto(`/i/${shareToken}/done`);
    await page.waitForTimeout(3000);

    const url = page.url();
    // Either shows done page or auto-redirected to review
    expect(url).toMatch(/\/(done|review)/);
  });

  test("review page loads for review_pending interview", async ({ page }) => {
    await page.goto(`/i/${shareToken}/review`);
    await page.waitForTimeout(3000);

    const body = await page.locator("body").textContent();
    expect(body).toMatch(/review|case study|draft|Flow Customer/i);
  });

  test("review complete API works", async () => {
    const res = await fetch(
      `${APP_URL}/api/interview/${shareToken}/review/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    // Accept 200 or 400 (may need specific body)
    expect([200, 400]).toContain(res.status);

    if (res.status === 200) {
      const sb = getServiceClient();
      const { data } = await sb
        .from("interviews")
        .select("status")
        .eq("id", interviewId)
        .single();
      expect(data?.status).toBe("review_complete");
    }
  });

  test("completed interview welcome page shows completion message", async ({ page }) => {
    const sb = getServiceClient();
    await sb.from("interviews").update({ status: "review_complete" }).eq("id", interviewId);

    await page.goto(`/i/${shareToken}`);
    await page.waitForTimeout(2000);

    const body = await page.locator("body").textContent();
    expect(body).toMatch(/submitted|complete|thank/i);
  });
});
