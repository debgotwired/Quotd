import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeamRole, canEditTeam } from "@/lib/teams/helpers";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { content } = await request.json();

  if (typeof content !== "string") {
    return NextResponse.json({ error: "Content must be a string" }, { status: 400 });
  }

  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership or team edit access
  const { data: interview, error: fetchError } = await supabase
    .from("interviews")
    .select("id, user_id, team_id")
    .eq("id", id)
    .single();

  if (fetchError || !interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const isOwner = interview.user_id === user.id;
  let hasTeamEditAccess = false;
  if (!isOwner && interview.team_id) {
    const role = await getTeamRole(supabase, interview.team_id, user.id);
    hasTeamEditAccess = canEditTeam(role);
  }
  if (!isOwner && !hasTeamEditAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update draft content
  const { error: updateError } = await supabase
    .from("interviews")
    .update({ draft_content: content })
    .eq("id", id);

  if (updateError) {
    console.error("Failed to save draft:", updateError);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
