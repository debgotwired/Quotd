import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getTeamRole, isTeamOwner } from "@/lib/teams/helpers";

export const GET = withApiAuth(async (_req, { userId, params }) => {
  const { teamId } = params;
  const supabase = await createServiceClient();

  const role = await getTeamRole(supabase, teamId, userId);
  if (!role) {
    return NextResponse.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const { data: members, error } = await supabase
    .from("team_members")
    .select("id, user_id, role, invited_email, accepted_at, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }

  return NextResponse.json({ data: members || [] });
});

export const POST = withApiAuth(async (req, { userId, params }) => {
  const { teamId } = params;

  let body: { email: string; role: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.email || typeof body.email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const validRoles = ["editor", "viewer"];
  if (!body.role || !validRoles.includes(body.role)) {
    return NextResponse.json({ error: "Role must be 'editor' or 'viewer'" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const currentRole = await getTeamRole(supabase, teamId, userId);
  if (!isTeamOwner(currentRole)) {
    return NextResponse.json({ error: "Only the team owner can add members" }, { status: 403 });
  }

  const { data: member, error } = await supabase
    .from("team_members")
    .insert({
      team_id: teamId,
      user_id: userId, // placeholder, will be updated when invite is accepted
      role: body.role,
      invited_email: body.email.trim(),
      invited_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }

  return NextResponse.json({ data: member }, { status: 201 });
});

export const DELETE = withApiAuth(async (req, { userId, params }) => {
  const { teamId } = params;

  let body: { userId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const currentRole = await getTeamRole(supabase, teamId, userId);
  if (!currentRole) {
    return NextResponse.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const targetRole = await getTeamRole(supabase, teamId, body.userId);
  if (targetRole === "owner") {
    return NextResponse.json({ error: "Cannot remove the team owner" }, { status: 400 });
  }

  if (body.userId !== userId && !isTeamOwner(currentRole)) {
    return NextResponse.json({ error: "Only the team owner can remove members" }, { status: 403 });
  }

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", body.userId);

  if (error) {
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
