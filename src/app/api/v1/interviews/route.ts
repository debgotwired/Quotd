import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { InterviewTone, InterviewFocus, TargetAudience } from "@/lib/supabase/types";

const VALID_TONES: InterviewTone[] = ["formal", "conversational", "technical"];
const VALID_FOCUSES: InterviewFocus[] = ["balanced", "roi", "technical", "storytelling"];
const VALID_AUDIENCES: TargetAudience[] = ["general", "c_suite", "technical_buyer", "end_user", "board"];

function generateShareToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const GET = withApiAuth(async (req, { userId }) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10) || 20));
  const status = searchParams.get("status");
  const offset = (page - 1) * perPage;

  const supabase = await createServiceClient();

  let query = supabase
    .from("interviews")
    .select("id, customer_company, product_name, status, share_token, customer_email, created_at, completed_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch interviews" }, { status: 500 });
  }

  return NextResponse.json({
    data: data || [],
    pagination: {
      page,
      per_page: perPage,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / perPage),
    },
  });
});

export const POST = withApiAuth(async (req, { userId }) => {
  let body: {
    customer_company: string;
    product_name: string;
    customer_email?: string;
    interview_tone?: InterviewTone;
    interview_focus?: InterviewFocus;
    target_audience?: TargetAudience;
    question_limit?: number;
    linkedin_profile_url?: string;
    company_website_url?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.customer_company || typeof body.customer_company !== "string" || !body.customer_company.trim()) {
    return NextResponse.json({ error: "customer_company is required" }, { status: 400 });
  }
  if (!body.product_name || typeof body.product_name !== "string" || !body.product_name.trim()) {
    return NextResponse.json({ error: "product_name is required" }, { status: 400 });
  }
  if (body.interview_tone && !VALID_TONES.includes(body.interview_tone)) {
    return NextResponse.json({ error: `Invalid tone. Must be one of: ${VALID_TONES.join(", ")}` }, { status: 400 });
  }
  if (body.interview_focus && !VALID_FOCUSES.includes(body.interview_focus)) {
    return NextResponse.json({ error: `Invalid focus. Must be one of: ${VALID_FOCUSES.join(", ")}` }, { status: 400 });
  }
  if (body.target_audience && !VALID_AUDIENCES.includes(body.target_audience)) {
    return NextResponse.json({ error: `Invalid audience. Must be one of: ${VALID_AUDIENCES.join(", ")}` }, { status: 400 });
  }
  if (body.question_limit !== undefined) {
    if (typeof body.question_limit !== "number" || body.question_limit < 5 || body.question_limit > 30) {
      return NextResponse.json({ error: "question_limit must be between 5 and 30" }, { status: 400 });
    }
  }

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("interviews")
    .insert({
      user_id: userId,
      customer_company: body.customer_company.trim(),
      product_name: body.product_name.trim(),
      customer_email: body.customer_email?.trim() || null,
      linkedin_profile_url: body.linkedin_profile_url?.trim() || null,
      company_website_url: body.company_website_url?.trim() || null,
      interview_tone: body.interview_tone || "conversational",
      interview_focus: body.interview_focus || "balanced",
      target_audience: body.target_audience || "general",
      question_limit: body.question_limit || 15,
      status: "draft",
      share_token: generateShareToken(),
      extraction_state: { metrics: [], quotes: [], facts: {}, question_count: 0 },
    })
    .select()
    .single();

  if (error) {
    console.error("API v1: Failed to create interview:", error);
    return NextResponse.json({ error: "Failed to create interview" }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
});
