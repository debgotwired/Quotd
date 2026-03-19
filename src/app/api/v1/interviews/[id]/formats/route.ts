import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { generateFormat } from "@/lib/ai/formats";
import type {
  FormatKey,
  GeneratedFormats,
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

export const GET = withApiAuth(async (_req, { userId, params }) => {
  const { id } = params;
  const supabase = await createServiceClient();

  const { data: interview } = await supabase
    .from("interviews")
    .select("id, generated_formats")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: (interview.generated_formats as GeneratedFormats) || {},
  });
});

export const POST = withApiAuth(async (req, { userId, params }) => {
  const { id } = params;

  let body: { format: string };
  try {
    body = await req.json();
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

  const supabase = await createServiceClient();

  const { data: interview } = await supabase
    .from("interviews")
    .select("id, user_id, customer_company, product_name, extraction_state, draft_content, generated_formats")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  if (!interview.draft_content || !interview.extraction_state) {
    return NextResponse.json(
      { error: "Interview must have a completed draft before generating formats" },
      { status: 400 }
    );
  }

  const extractionState = interview.extraction_state as ExtractionState;
  const existingFormats = (interview.generated_formats as GeneratedFormats) || {};
  const formatsToGenerate: FormatKey[] = format === "all" ? VALID_FORMATS : [format as FormatKey];

  const results = await Promise.allSettled(
    formatsToGenerate.map(async (key) => {
      const content = await generateFormat(
        key,
        interview.customer_company,
        interview.product_name,
        extractionState,
        interview.draft_content!
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
    }
  }

  const { error: updateError } = await supabase
    .from("interviews")
    .update({ generated_formats: newFormats })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to save generated formats" }, { status: 500 });
  }

  const responseFormats: GeneratedFormats = {};
  for (const key of formatsToGenerate) {
    if (newFormats[key]) {
      responseFormats[key] = newFormats[key];
    }
  }

  return NextResponse.json({
    data: responseFormats,
    ...(errors.length > 0 && { errors }),
  });
});
