import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeamRole, isTeamOwner } from "@/lib/teams/helpers";
import type { TeamRole } from "@/lib/supabase/types";

/**
 * DELETE /api/teams/[teamId]/members — Remove a member from the team.
 * Body: { userId: string }
 * Owner can remove anyone (except themselves). Members can remove themselves.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { userId } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const currentRole = await getTeamRole(supabase, teamId, user.id);
  if (!currentRole) {
    return NextResponse.json({ error: "Not a member of this team" }, { status: 403 });
  }

  // Owner cannot be removed
  const targetRole = await getTeamRole(supabase, teamId, userId);
  if (targetRole === "owner") {
    return NextResponse.json({ error: "Cannot remove the team owner" }, { status: 400 });
  }

  // Only owner can remove others; members can remove themselves
  if (userId !== user.id && !isTeamOwner(currentRole)) {
    return NextResponse.json({ error: "Only the team owner can remove members" }, { status: 403 });
  }

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to remove member:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * PUT /api/teams/[teamId]/members — Update a member's role.
 * Body: { userId: string, role: "editor" | "viewer" }
 * Owner only. Cannot change own role.
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

  const currentRole = await getTeamRole(supabase, teamId, user.id);
  if (!isTeamOwner(currentRole)) {
    return NextResponse.json({ error: "Only the team owner can change roles" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, role } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const validRoles: TeamRole[] = ["editor", "viewer"];
  if (!role || !validRoles.includes(role)) {
    return NextResponse.json({ error: "Role must be 'editor' or 'viewer'" }, { status: 400 });
  }

  if (userId === user.id) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const { error } = await supabase
    .from("team_members")
    .update({ role })
    .eq("team_id", teamId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update role:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
