import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("id, opened_at")
    .eq("share_token", token)
    .single();

  if (error || !interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  // Only set opened_at on first open (idempotent)
  if (!interview.opened_at) {
    await supabase
      .from("interviews")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", interview.id);
  }

  return NextResponse.json({ success: true });
}
