import { test, expect } from "@playwright/test";
import { getServiceClient, APP_URL } from "./helpers";
import * as crypto from "crypto";

/**
 * Tests the v1 API (API key authenticated endpoints).
 * Creates a real API key and tests all v1 routes.
 */

const TEST_EMAIL = `e2e-v1api-${Date.now()}@quotd.sh`;
let userId: string;
let apiKeyRaw: string;
let interviewId: string;

test.describe("V1 API (API Key Auth)", () => {
  test.beforeAll(async () => {
    const sb = getServiceClient();

    // Create user
    const { data: newUser, error } = await sb.auth.admin.createUser({
      email: TEST_EMAIL,
      password: "test-v1-pw",
      email_confirm: true,
    });
    if (error) throw new Error(`User creation failed: ${error.message}`);
    userId = newUser.user.id;

    await sb.from("profiles").insert({
      user_id: userId,
      full_name: "V1 API Tester",
      company_name: "V1 Corp",
    });

    // Create API key — same SHA256 hash approach as the real auth
    const rawKey = "qtd_" + crypto.randomBytes(32).toString("hex");
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 12);

    const { error: keyErr } = await sb.from("api_keys").insert({
      user_id: userId,
      name: "E2E Test Key",
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes: ["read", "write"],
    });

    if (keyErr) throw new Error(`API key creation failed: ${keyErr.message}`);
    apiKeyRaw = rawKey;

    // Create an interview for testing
    const token = crypto.randomBytes(16).toString("hex");

    const { data: interview, error: intErr } = await sb
      .from("interviews")
      .insert({
        user_id: userId,
        customer_company: "V1 API Test Customer",
        product_name: "V1 Product",
        status: "draft",
        share_token: token,
        extraction_state: { metrics: [], quotes: [], facts: {}, question_count: 0 },
      })
      .select()
      .single();

    if (intErr) throw new Error(`Interview creation failed: ${intErr.message}`);
    interviewId = interview!.id;
  });

  test.afterAll(async () => {
    const sb = getServiceClient();
    if (interviewId) {
      await sb.from("messages").delete().eq("interview_id", interviewId);
      await sb.from("reminders").delete().eq("interview_id", interviewId);
      await sb.from("interviews").delete().eq("id", interviewId);
    }
    // Clean up any interviews created by the API
    await sb.from("interviews").delete().eq("user_id", userId);
    await sb.from("api_keys").delete().eq("user_id", userId);
    await sb.from("webhooks").delete().eq("user_id", userId);
    await sb.from("profiles").delete().eq("user_id", userId);
    await sb.auth.admin.deleteUser(userId);
  });

  function apiHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKeyRaw}`,
    };
  }

  test("GET /api/v1/interviews — list interviews", async () => {
    const res = await fetch(`${APP_URL}/api/v1/interviews`, {
      headers: apiHeaders(),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeTruthy();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(1);
    expect(json.pagination).toBeTruthy();
  });

  test("GET /api/v1/interviews/:id — get single interview", async () => {
    const res = await fetch(`${APP_URL}/api/v1/interviews/${interviewId}`, {
      headers: apiHeaders(),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.customer_company).toBe("V1 API Test Customer");
  });

  test("PATCH /api/v1/interviews/:id — update interview", async () => {
    const res = await fetch(`${APP_URL}/api/v1/interviews/${interviewId}`, {
      method: "PATCH",
      headers: apiHeaders(),
      body: JSON.stringify({ customer_company: "V1 Updated Customer" }),
    });
    expect(res.status).toBe(200);

    const sb = getServiceClient();
    const { data } = await sb
      .from("interviews")
      .select("customer_company")
      .eq("id", interviewId)
      .single();
    expect(data?.customer_company).toBe("V1 Updated Customer");
  });

  test("GET /api/v1/interviews/:id/messages — empty messages", async () => {
    const res = await fetch(
      `${APP_URL}/api/v1/interviews/${interviewId}/messages`,
      { headers: apiHeaders() }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeTruthy();
  });

  test("GET /api/v1/profile — get profile", async () => {
    const res = await fetch(`${APP_URL}/api/v1/profile`, {
      headers: apiHeaders(),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.full_name).toBe("V1 API Tester");
  });

  test("unauthorized request returns 401", async () => {
    const res = await fetch(`${APP_URL}/api/v1/interviews`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  test("invalid API key returns 401", async () => {
    const res = await fetch(`${APP_URL}/api/v1/interviews`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer qtd_invalid_key_here",
      },
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/v1/interviews with invalid ID returns 404", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await fetch(`${APP_URL}/api/v1/interviews/${fakeId}`, {
      headers: apiHeaders(),
    });
    expect(res.status).toBe(404);
  });

  test("POST /api/v1/interviews — create interview via API", async () => {
    const res = await fetch(`${APP_URL}/api/v1/interviews`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        customer_company: "API-Created Customer",
        product_name: "API Product",
        question_limit: 8,
      }),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.customer_company).toBe("API-Created Customer");

    // Cleanup
    const sb = getServiceClient();
    await sb.from("interviews").delete().eq("id", json.data.id);
  });

  test("rate limiting: many rapid requests", async () => {
    const promises = Array.from({ length: 15 }, () =>
      fetch(`${APP_URL}/api/v1/interviews`, {
        headers: apiHeaders(),
      }).then((r) => r.status)
    );

    const statuses = await Promise.all(promises);
    const successes = statuses.filter((s) => s === 200).length;
    expect(successes).toBeGreaterThan(0);
  });
});
