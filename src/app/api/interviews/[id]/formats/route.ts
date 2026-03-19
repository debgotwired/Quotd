import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFormat } from "@/lib/ai/formats";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
import type {
  FormatKey,
  GeneratedFormats,
  GeneratedFormat,
  ExtractionState,
} from "@/lib/supabase/types";

const VALID_FORMATS: FormatKey[] = [
  "one_pager",
  "linkedin",
  "twitter",
  "sales_slide",
  "quote_cards",
  "email_blurb",
];

function isFormatKey(value: string): value is FormatKey {
  return VALID_FORMATS.includes(value as FormatKey);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { format: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { format } = body;
  if (!format || (format !== "all" && !isFormatKey(format))) {
    return NextResponse.json(
      { error: "Invalid format. Use one of: " + VALID_FORMATS.join(", ") + ', or "all"' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch interview with ownership check
  const { data: interview, error: fetchError } = await supabase
    .from("interviews")
    .select("id, user_id, customer_company, product_name, extraction_state, draft_content, generated_formats")
    .eq("id", id)
    .single();

  if (fetchError || !interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  if (interview.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!interview.draft_content || !interview.extraction_state) {
    return NextResponse.json(
      { error: "Interview must have a completed draft before generating formats" },
      { status: 400 }
    );
  }

  const extractionState = interview.extraction_state as ExtractionState;
  const existingFormats = (interview.generated_formats as GeneratedFormats) || {};
  const formatsToGenerate: FormatKey[] =
    format === "all" ? VALID_FORMATS : [format as FormatKey];

  // Generate formats (parallel for "all")
  const results = await Promise.allSettled(
    formatsToGenerate.map(async (key) => {
      const content = await generateFormat(
        key,
        interview.customer_company,
        interview.product_name,
        extractionState,
        interview.draft_content
      );
      return { key, content };
    })
  );

  const newFormats: GeneratedFormats = { ...existingFormats };
  const generatedAt = new Date().toISOString();
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      newFormats[result.value.key] = {
        content: result.value.content,
        generated_at: generatedAt,
      };
    } else {
      const failedKey = formatsToGenerate[results.indexOf(result)];
      errors.push(failedKey);
      console.error(`Failed to generate format ${failedKey}:`, result.reason);
    }
  }

  // Save to database
  const { error: updateError } = await supabase
    .from("interviews")
    .update({ generated_formats: newFormats })
    .eq("id", id);

  if (updateError) {
    console.error("Failed to save formats:", updateError);
    return NextResponse.json({ error: "Failed to save generated formats" }, { status: 500 });
  }

  // Dispatch webhook (fire and forget)
  dispatchWebhookEvent(user.id, "format.generated", {
    interview_id: id,
    formats: formatsToGenerate.filter((k) => newFormats[k]),
  }).catch(console.error);

  // Build response with only the newly generated formats
  const responseFormats: GeneratedFormats = {};
  for (const key of formatsToGenerate) {
    if (newFormats[key]) {
      responseFormats[key] = newFormats[key];
    }
  }

  return NextResponse.json({
    formats: responseFormats,
    ...(errors.length > 0 && { errors }),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { format: string; content: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { format, content } = body;
  if (!format || !isFormatKey(format)) {
    return NextResponse.json(
      { error: "Invalid format. Use one of: " + VALID_FORMATS.join(", ") },
      { status: 400 }
    );
  }
  if (typeof content !== "string") {
    return NextResponse.json({ error: "Content must be a string" }, { status: 400 });
  }

  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch interview
  const { data: interview, error: fetchError } = await supabase
    .from("interviews")
    .select("id, user_id, generated_formats")
    .eq("id", id)
    .single();

  if (fetchError || !interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  if (interview.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existingFormats = (interview.generated_formats as GeneratedFormats) || {};
  const existingFormat = existingFormats[format as FormatKey];

  if (!existingFormat) {
    return NextResponse.json(
      { error: "Format has not been generated yet" },
      { status: 400 }
    );
  }

  const updatedFormats: GeneratedFormats = {
    ...existingFormats,
    [format]: {
      ...existingFormat,
      content,
      edited: true,
    } satisfies GeneratedFormat,
  };

  const { error: updateError } = await supabase
    .from("interviews")
    .update({ generated_formats: updatedFormats })
    .eq("id", id);

  if (updateError) {
    console.error("Failed to save format edit:", updateError);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
