import { NextRequest, NextResponse } from "next/server";

/**
 * Receives Sentry webhook alerts, extracts error info,
 * and triggers a GitHub Actions `repository_dispatch` to
 * auto-diagnose and open a fix PR.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Sentry sends different webhook payloads — we care about issue alerts
    const action = body.action;
    const data = body.data || {};
    const issue = data.issue || body.event || {};

    const title = issue.title || issue.message || "Unknown Sentry error";
    const culprit = issue.culprit || "";
    const url = issue.web_url || issue.url || "";
    const metadata = issue.metadata || {};
    const stacktrace = extractStacktrace(body);

    // Only trigger for new/regression errors, not resolved/ignored
    if (action && !["created", "triggered", "regression"].includes(action)) {
      return NextResponse.json({ skipped: true, reason: `action=${action}` });
    }

    // Trigger GitHub Actions via repository_dispatch
    const ghToken = process.env.GITHUB_PAT;
    if (!ghToken) {
      console.error("GITHUB_PAT not set — cannot trigger auto-fix");
      return NextResponse.json({ error: "GITHUB_PAT not configured" }, { status: 500 });
    }

    const dispatchRes = await fetch(
      "https://api.github.com/repos/debgotwired/Quotd/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          event_type: "sentry-error",
          client_payload: {
            title,
            culprit,
            url,
            stacktrace: stacktrace.slice(0, 3000), // Keep under payload limits
            filename: metadata.filename || extractFilename(culprit),
            function: metadata.function || "",
          },
        }),
      }
    );

    if (!dispatchRes.ok) {
      const errText = await dispatchRes.text();
      console.error("GitHub dispatch failed:", errText);
      return NextResponse.json({ error: "GitHub dispatch failed" }, { status: 502 });
    }

    return NextResponse.json({ dispatched: true, title });
  } catch (error) {
    console.error("Sentry webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

function extractStacktrace(body: Record<string, unknown>): string {
  try {
    // Sentry nests stacktraces differently depending on webhook type
    const event = (body.event as Record<string, unknown>) || {};
    const exception = (event.exception as Record<string, unknown>) || {};
    const values = (exception.values as Array<Record<string, unknown>>) || [];

    if (values.length > 0) {
      const frames =
        ((values[0].stacktrace as Record<string, unknown>)?.frames as Array<Record<string, unknown>>) || [];
      return frames
        .slice(-10) // Last 10 frames (most relevant)
        .map(
          (f) =>
            `  at ${f.function || "?"} (${f.filename || "?"}:${f.lineno || "?"})`
        )
        .join("\n");
    }

    // Fallback: use title/message
    const issue = (body.data as Record<string, unknown>)?.issue as Record<string, unknown>;
    return (issue?.title as string) || "No stacktrace available";
  } catch {
    return "Failed to extract stacktrace";
  }
}

function extractFilename(culprit: string): string {
  // Culprit is usually like "app/api/auth/verify-otp/route"
  if (!culprit) return "";
  // Convert to file path
  return culprit.replace(/\./g, "/") + ".ts";
}
