import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getTeamRole, isTeamOwner } from "@/lib/teams/helpers";
import type { TeamMemberWithProfile } from "@/lib/supabase/types";

/**
 * GET /api/teams/[teamId] — Get team details including members with profiles.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify membership
  const role = await getTeamRole(supabase, teamId, user.id);
  if (!role) {
    return NextResponse.json({ error: "Not a member of this team" }, { status: 403 });
  }

  // Get team
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single();

  if (teamError || !team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Get members
  const { data: members } = await supabase
    .from("team_members")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  // Enrich members with profile data using service client
  const serviceSupabase = await createServiceClient();
  const enrichedMembers: TeamMemberWithProfile[] = [];

  for (const member of members || []) {
    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("full_name, company_name")
      .eq("user_id", member.user_id)
      .single();

    enrichedMembers.push({
      ...member,
      profile: profile || null,
    });
  }

  // Get pending invites (only for owner)
  let invites: { id: string; email: string; role: string; expires_at: string; created_at: string }[] = [];
  if (isTeamOwner(role)) {
    const { data: inviteData } = await supabase
      .from("team_invites")
      .select("id, email, role, expires_at, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    invites = inviteData || [];
  }

  return NextResponse.json({
    team,
    members: enrichedMembers,
    invites,
    currentUserRole: role,
  });
}

/**
 * PUT /api/teams/[teamId] — Update team name (owner only).
 * Body: { name: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getTeamRole(supabase, teamId, user.id);
  if (!isTeamOwner(role)) {
    return NextResponse.json({ error: "Only the team owner can update the team" }, { status: 403 });
  }

  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }

  if (name.trim().length > 100) {
    return NextResponse.json({ error: "Team name must be 100 characters or less" }, { status: 400 });
  }

  const { data: team, error } = await supabase
    .from("teams")
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", teamId)
    .select()
    .single();

  if (error) {
    console.error("Failed to update team:", error);
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }

  return NextResponse.json({ team });
}

/**
 * DELETE /api/teams/[teamId] — Delete a team (owner only).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getTeamRole(supabase, teamId, user.id);
  if (!isTeamOwner(role)) {
    return NextResponse.json({ error: "Only the team owner can delete the team" }, { status: 403 });
  }

  // Unlink interviews from this team before deleting
  const serviceSupabase = await createServiceClient();
  await serviceSupabase
    .from("interviews")
    .update({ team_id: null })
    .eq("team_id", teamId);

  // Delete team (cascades to team_members and team_invites)
  const { error } = await supabase
    .from("teams")
    .delete()
    .eq("id", teamId);

  if (error) {
    console.error("Failed to delete team:", error);
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
