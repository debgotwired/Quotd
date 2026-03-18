import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isInterviewDone } from "@/lib/review/helpers";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { content } = await request.json();

  if (typeof content !== "string") {
    return NextResponse.json({ error: "Content must be a string" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("id, status")
    .eq("share_token", token)
    .single();

  if (error || !interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  if (!isInterviewDone(interview.status) || interview.status === "review_complete") {
    return NextResponse.json({ error: "Editing not available" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("interviews")
    .update({ customer_draft_content: content })
    .eq("id", interview.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
