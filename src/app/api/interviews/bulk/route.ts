import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { InterviewTone, InterviewFocus, TargetAudience } from "@/lib/supabase/types";

function generateShareToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

type BulkInterviewInput = {
  customer_company: string;
  product_name: string;
  customer_email?: string | null;
  linkedin_profile_url?: string | null;
  company_website_url?: string | null;
  interview_tone?: InterviewTone;
  interview_focus?: InterviewFocus;
  target_audience?: TargetAudience;
  question_limit?: number;
};

const VALID_TONES: InterviewTone[] = ["formal", "conversational", "technical"];
const VALID_FOCUSES: InterviewFocus[] = ["balanced", "roi", "technical", "storytelling"];
const VALID_AUDIENCES: TargetAudience[] = ["general", "c_suite", "technical_buyer", "end_user", "board"];
const MAX_BATCH_SIZE = 100;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { interviews: BulkInterviewInput[] };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.interviews || !Array.isArray(body.interviews)) {
    return NextResponse.json(
      { error: "Request body must contain an 'interviews' array" },
      { status: 400 }
    );
  }

  if (body.interviews.length === 0) {
    return NextResponse.json(
      { error: "At least one interview is required" },
      { status: 400 }
    );
  }

  if (body.interviews.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Maximum ${MAX_BATCH_SIZE} interviews per batch` },
      { status: 400 }
    );
  }

  // Validate each row
  const validationErrors: { index: number; field: string; message: string }[] = [];

  for (let i = 0; i < body.interviews.length; i++) {
    const row = body.interviews[i];

    if (!row.customer_company || typeof row.customer_company !== "string" || row.customer_company.trim().length === 0) {
      validationErrors.push({ index: i, field: "customer_company", message: "Customer company is required" });
      continue;
    }

    if (row.customer_company.length > 200) {
      validationErrors.push({ index: i, field: "customer_company", message: "Customer company must be 200 characters or less" });
      continue;
    }

    if (!row.product_name || typeof row.product_name !== "string" || row.product_name.trim().length === 0) {
      validationErrors.push({ index: i, field: "product_name", message: "Product name is required" });
      continue;
    }

    if (row.product_name.length > 200) {
      validationErrors.push({ index: i, field: "product_name", message: "Product name must be 200 characters or less" });
      continue;
    }

    if (row.interview_tone && !VALID_TONES.includes(row.interview_tone)) {
      validationErrors.push({ index: i, field: "interview_tone", message: `Invalid tone. Must be one of: ${VALID_TONES.join(", ")}` });
    }

    if (row.interview_focus && !VALID_FOCUSES.includes(row.interview_focus)) {
      validationErrors.push({ index: i, field: "interview_focus", message: `Invalid focus. Must be one of: ${VALID_FOCUSES.join(", ")}` });
    }

    if (row.target_audience && !VALID_AUDIENCES.includes(row.target_audience)) {
      validationErrors.push({ index: i, field: "target_audience", message: `Invalid audience. Must be one of: ${VALID_AUDIENCES.join(", ")}` });
    }

    if (row.question_limit !== undefined) {
      if (typeof row.question_limit !== "number" || isNaN(row.question_limit) || row.question_limit < 5 || row.question_limit > 30) {
        validationErrors.push({ index: i, field: "question_limit", message: "Question limit must be a number between 5 and 30" });
      }
    }
  }

  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", validation_errors: validationErrors },
      { status: 400 }
    );
  }

  // Build insert rows
  const insertRows = body.interviews.map((row) => ({
    user_id: user.id,
    customer_company: row.customer_company.trim(),
    product_name: row.product_name.trim(),
    customer_email: row.customer_email?.trim() || null,
    linkedin_profile_url: row.linkedin_profile_url?.trim() || null,
    company_website_url: row.company_website_url?.trim() || null,
    interview_tone: row.interview_tone || "conversational",
    interview_focus: row.interview_focus || "balanced",
    target_audience: row.target_audience || "general",
    question_limit: row.question_limit || 15,
    status: "draft" as const,
    share_token: generateShareToken(),
    extraction_state: {
      metrics: [],
      quotes: [],
      facts: {},
      question_count: 0,
    },
  }));

  const { data, error } = await supabase
    .from("interviews")
    .insert(insertRows)
    .select();

  if (error) {
    console.error("Bulk insert failed:", error);
    return NextResponse.json(
      { error: "Failed to create interviews" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    created: data.length,
    interviews: data.map((interview) => ({
      id: interview.id,
      customer_company: interview.customer_company,
      product_name: interview.product_name,
      customer_email: interview.customer_email,
      share_token: interview.share_token,
      status: interview.status,
    })),
  });
}
