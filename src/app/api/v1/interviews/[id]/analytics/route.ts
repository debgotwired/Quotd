import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createServiceClient } from "@/lib/supabase/server";

export const GET = withApiAuth(async (_req, { userId, params }) => {
  const { id } = params;
  const supabase = await createServiceClient();

  const { data: interview } = await supabase
    .from("interviews")
    .select("id, extraction_state")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: interview.extraction_state || { metrics: [], quotes: [], facts: {}, question_count: 0 },
  });
});
