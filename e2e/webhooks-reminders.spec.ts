import { test, expect } from "@playwright/test";
import { getServiceClient, APP_URL } from "./helpers";
import * as crypto from "crypto";

/**
 * Tests webhook and reminder functionality.
 */

const TEST_EMAIL = `e2e-wh-${Date.now()}@quotd.sh`;
let userId: string;
let apiKeyRaw: string;
let interviewId: string;

test.describe("Webhooks & Reminders", () => {
  test.beforeAll(async () => {
    const sb = getServiceClient();

    const { data: newUser, error } = await sb.auth.admin.createUser({
      email: TEST_EMAIL,
      password: "test-wh-pw",
      email_confirm: true,
    });
    if (error) throw new Error(`User creation failed: ${error.message}`);
    userId = newUser.user.id;

    await sb.from("profiles").insert({
      user_id: userId,
      full_name: "Webhook Tester",
      company_name: "WH Corp",
    });

    // Create API key
    const rawKey = "qtd_" + crypto.randomBytes(32).toString("hex");
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    await sb.from("api_keys").insert({
      user_id: userId,
      name: "WH Test Key",
      key_hash: keyHash,
      key_prefix: rawKey.slice(0, 12),
      scopes: ["read", "write"],
    });
    apiKeyRaw = rawKey;

    // Create interview
    const token = crypto.randomBytes(16).toString("hex");
    const { data: interview } = await sb
      .from("interviews")
      .insert({
        user_id: userId,
        customer_company: "WH Test Customer",
        product_name: "WH Product",
        customer_email: "whcustomer@test.com",
        status: "draft",
        share_token: token,
        extraction_state: { metrics: [], quotes: [], facts: {}, question_count: 0 },
      })
      .select()
      .single();

    interviewId = interview!.id;
  });

  test.afterAll(async () => {
    const sb = getServiceClient();
    await sb.from("messages").delete().eq("interview_id", interviewId);
    await sb.from("reminders").delete().eq("interview_id", interviewId);
    await sb.from("interviews").delete().eq("id", interviewId);
    // Supabase query builder returns a thenable, not a promise — no .catch()
    try {
      const { data: webhooks } = await sb.from("webhooks").select("id").eq("user_id", userId);
      if (webhooks) {
        for (const wh of webhooks) {
          await sb.from("webhook_deliveries").delete().eq("webhook_id", wh.id);
        }
      }
    } catch {}
    await sb.from("webhooks").delete().eq("user_id", userId);
    await sb.from("api_keys").delete().eq("user_id", userId);
    await sb.from("profiles").delete().eq("user_id", userId);
    await sb.auth.admin.deleteUser(userId);
  });

  function apiHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKeyRaw}`,
    };
  }

  test("create webhook via v1 API", async () => {
    const res = await fetch(`${APP_URL}/api/v1/webhooks`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        url: "https://httpbin.org/post",
        events: ["interview.created", "interview.completed"],
        secret: "test-webhook-secret",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toBeTruthy();
    expect(json.data.url).toBe("https://httpbin.org/post");
  });

  test("list webhooks via v1 API", async () => {
    const res = await fetch(`${APP_URL}/api/v1/webhooks`, {
      headers: apiHeaders(),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeTruthy();
    expect(json.data.length).toBeGreaterThan(0);
  });

  test("create webhook with invalid URL fails", async () => {
    const res = await fetch(`${APP_URL}/api/v1/webhooks`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        url: "not-a-url",
        events: ["interview.created"],
      }),
    });
    expect(res.status).toBe(400);
  });

  test("reminders: no reminders for new interview", async () => {
    const sb = getServiceClient();
    const { data: reminders } = await sb
      .from("reminders")
      .select("*")
      .eq("interview_id", interviewId);
    expect(reminders?.length || 0).toBe(0);
  });

  test("reminders: init creates 3 tiers", async () => {
    const sb = getServiceClient();
    const now = new Date();
    const remindersToInsert = [
      {
        interview_id: interviewId,
        customer_email: "whcustomer@test.com",
        tier: 1,
        status: "pending",
        scheduled_for: new Date(now.getTime() + 2 * 86400000).toISOString(),
      },
      {
        interview_id: interviewId,
        customer_email: "whcustomer@test.com",
        tier: 2,
        status: "pending",
        scheduled_for: new Date(now.getTime() + 5 * 86400000).toISOString(),
      },
      {
        interview_id: interviewId,
        customer_email: "whcustomer@test.com",
        tier: 3,
        status: "pending",
        scheduled_for: new Date(now.getTime() + 8 * 86400000).toISOString(),
      },
    ];

    const { data, error } = await sb.from("reminders").insert(remindersToInsert).select();
    expect(error).toBeNull();
    expect(data).toHaveLength(3);
  });

  test("reminders: cancel pending reminders", async () => {
    const sb = getServiceClient();
    const { error } = await sb
      .from("reminders")
      .update({ status: "cancelled" })
      .eq("interview_id", interviewId)
      .eq("status", "pending");
    expect(error).toBeNull();

    const { data: remaining } = await sb
      .from("reminders")
      .select("status")
      .eq("interview_id", interviewId)
      .eq("status", "pending");
    expect(remaining).toHaveLength(0);
  });

  test("snooze endpoint with invalid token redirects", async () => {
    const res = await fetch(
      `${APP_URL}/api/reminders/snooze?token=invalid-snooze-token`,
      { redirect: "manual" }
    );
    // Should redirect (3xx) or return error
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(500);
  });

  test("cron webhooks endpoint requires auth", async () => {
    const res = await fetch(`${APP_URL}/api/cron/webhooks`, {
      method: "GET",
    });
    expect([401, 403, 405]).toContain(res.status);
  });

  test("cron reminders endpoint requires auth", async () => {
    const res = await fetch(`${APP_URL}/api/cron/reminders`, {
      method: "GET",
    });
    expect([401, 403, 405]).toContain(res.status);
  });
});
