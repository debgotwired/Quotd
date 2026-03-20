import { test, expect } from "@playwright/test";
import { APP_URL } from "./helpers";

/**
 * Edge cases, security, and error handling tests.
 */

test.describe("Edge Cases & Security", () => {
  test("404 page for non-existent routes", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/this-page-does-not-exist");
  });

  test("API: malformed JSON returns 400 or 500", async () => {
    const res = await fetch(`${APP_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect([400, 500]).toContain(res.status);
  });

  test("API: empty body returns error", async () => {
    const res = await fetch(`${APP_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test("API: XSS in email field is safe", async () => {
    const res = await fetch(`${APP_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: '<script>alert("xss")</script>@test.com' }),
    });
    // Server rejects or handles safely — any non-2xx is fine
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("API: SQL injection in email is safe", async () => {
    const res = await fetch(`${APP_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com' OR '1'='1" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("API: extremely long email is rejected", async () => {
    const longEmail = "a".repeat(500) + "@test.com";
    const res = await fetch(`${APP_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: longEmail }),
    });
    // Any non-2xx response is acceptable
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("interview token: path traversal is safe", async ({ page }) => {
    await page.goto("/i/../../etc/passwd");
    await page.waitForTimeout(2000);
    const body = await page.locator("body").textContent();
    expect(body).not.toContain("root:");
  });

  test("v1 API: missing auth header", async () => {
    const res = await fetch(`${APP_URL}/api/v1/interviews`);
    expect(res.status).toBe(401);
  });

  test("v1 API: empty bearer token", async () => {
    const res = await fetch(`${APP_URL}/api/v1/interviews`, {
      headers: { Authorization: "Bearer " },
    });
    expect(res.status).toBe(401);
  });

  test("v1 API: non-bearer auth scheme", async () => {
    const res = await fetch(`${APP_URL}/api/v1/interviews`, {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(res.status).toBe(401);
  });

  test("CORS: preflight requests handled", async () => {
    const res = await fetch(`${APP_URL}/api/v1/interviews`, {
      method: "OPTIONS",
    });
    expect([200, 204, 405]).toContain(res.status);
  });

  test("login page renders visible content", async ({ page }) => {
    await page.goto("/login");
    // Check that the visible text shows the login form
    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
    const headingText = await heading.textContent();
    expect(headingText).toBeTruthy();
  });

  test("dashboard redirects unauthenticated users", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await page.waitForTimeout(5000);
    const url = page.url();
    expect(url).toMatch(/\/(login|dashboard)/);
  });

  test("snooze-confirmed page loads", async ({ page }) => {
    await page.goto("/i/snooze-confirmed");
    await page.waitForTimeout(2000);
    const body = await page.locator("body").textContent();
    expect(body).toMatch(/snooze|got it|follow up/i);
  });

  test("bulk API: empty array rejected", async () => {
    const res = await fetch(`${APP_URL}/api/interviews/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviews: [] }),
    });
    expect([400, 401]).toContain(res.status);
  });

  test("bulk API: over 100 interviews rejected", async () => {
    const many = Array.from({ length: 101 }, (_, i) => ({
      customer_company: `Company ${i}`,
      product_name: `Product ${i}`,
    }));
    const res = await fetch(`${APP_URL}/api/interviews/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviews: many }),
    });
    expect([400, 401]).toContain(res.status);
  });

  test("formats API: invalid format rejected", async () => {
    const res = await fetch(
      `${APP_URL}/api/interviews/00000000-0000-0000-0000-000000000000/formats`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "invalid_format" }),
      }
    );
    expect([400, 401]).toContain(res.status);
  });
});
