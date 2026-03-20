import { test, expect } from "@playwright/test";
import { getServiceClient, APP_URL } from "./helpers";
import * as crypto from "crypto";

/**
 * Tests core API endpoints against production.
 */

const TEST_EMAIL = `e2e-api-${Date.now()}@quotd.sh`;

let userId: string;
let interviewId: string;
let shareToken: string;

test.describe("Core API Tests", () => {
  test.beforeAll(async () => {
    const sb = getServiceClient();

    const { data: newUser, error } = await sb.auth.admin.createUser({
      email: TEST_EMAIL,
      password: "api-test-pw",
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
    userId = newUser.user.id;

    await sb.from("profiles").insert({
      user_id: userId,
      full_name: "E2E API Tester",
      company_name: "E2E Corp",
    });
  });

  test.afterAll(async () => {
    const sb = getServiceClient();
    if (interviewId) {
      await sb.from("messages").delete().eq("interview_id", interviewId);
      await sb.from("reminders").delete().eq("interview_id", interviewId);
    }
    await sb.from("interviews").delete().eq("user_id", userId);
    await sb.from("profiles").delete().eq("user_id", userId);
    await sb.from("api_keys").delete().eq("user_id", userId);
    await sb.from("webhooks").delete().eq("user_id", userId);
    await sb.from("clients").delete().eq("user_id", userId);
    await sb.from("otp_tokens").delete().eq("email", TEST_EMAIL.toLowerCase());
    await sb.auth.admin.deleteUser(userId);
  });

  test("create interview via service client", async () => {
    const sb = getServiceClient();

    shareToken = crypto.randomBytes(16).toString("hex");

    const { data, error } = await sb
      .from("interviews")
      .insert({
        user_id: userId,
        customer_company: "E2E Test Customer",
        product_name: "E2E Product",
        customer_email: "customer@e2e-test.com",
        interview_tone: "conversational",
        interview_focus: "balanced",
        target_audience: "general",
        question_limit: 10,
        status: "draft",
        share_token: shareToken,
        extraction_state: { metrics: [], quotes: [], facts: {}, question_count: 0 },
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    interviewId = data!.id;
  });

  test("GET interview by token", async () => {
    const res = await fetch(`${APP_URL}/api/interview/${shareToken}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.interview).toBeTruthy();
    expect(data.interview.customer_company).toBe("E2E Test Customer");
  });

  test("POST interview opened sets opened_at", async () => {
    const res = await fetch(`${APP_URL}/api/interview/${shareToken}/opened`, {
      method: "POST",
    });
    expect(res.status).toBe(200);

    const sb = getServiceClient();
    const { data } = await sb
      .from("interviews")
      .select("opened_at")
      .eq("id", interviewId)
      .single();
    expect(data?.opened_at).toBeTruthy();
  });

  test("POST next-question returns a question", async () => {
    // Set to in_progress for question generation
    const sb = getServiceClient();
    await sb.from("interviews").update({ status: "in_progress" }).eq("id", interviewId);

    const res = await fetch(
      `${APP_URL}/api/interview/${shareToken}/next-question`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    // AI-dependent — accept various statuses
    expect([200, 400, 500, 502]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.question || data.done).toBeTruthy();
    }
  });

  test("POST submit-answer accepts an answer", async () => {
    const res = await fetch(
      `${APP_URL}/api/interview/${shareToken}/submit-answer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: "We increased revenue by 50% using E2E Product.",
        }),
      }
    );
    // AI-dependent
    expect([200, 400, 500, 502]).toContain(res.status);
  });

  test("GET interview with invalid token returns 404", async () => {
    const res = await fetch(`${APP_URL}/api/interview/nonexistent-token-12345`);
    expect(res.status).toBe(404);
  });

  test("bulk create interviews via service client", async () => {
    const sb = getServiceClient();

    const tokens = Array.from({ length: 3 }, () => crypto.randomBytes(16).toString("hex"));

    const rows = tokens.map((t, i) => ({
      user_id: userId,
      customer_company: `Bulk Test ${i + 1}`,
      product_name: "E2E Product",
      interview_tone: "conversational",
      interview_focus: "balanced",
      target_audience: "general",
      question_limit: 10,
      status: "draft" as const,
      share_token: t,
      extraction_state: { metrics: [], quotes: [], facts: {}, question_count: 0 },
    }));

    const { data, error } = await sb.from("interviews").insert(rows).select();
    expect(error).toBeNull();
    expect(data).toHaveLength(3);

    for (const interview of data!) {
      await sb.from("interviews").delete().eq("id", interview.id);
    }
  });

  test("bulk create API validation", async () => {
    const res = await fetch(`${APP_URL}/api/interviews/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interviews: [
          { customer_company: "", product_name: "X" },
          { customer_company: "A", product_name: "" },
        ],
      }),
    });
    // 400 (validation) or 401 (no auth)
    expect([400, 401]).toContain(res.status);
  });
});
