import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/teams/invite/[token] — Get invite details (for the accept page).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const serviceSupabase = await createServiceClient();

  const { data: invite, error } = await serviceSupabase
    .from("team_invites")
    .select("id, team_id, email, role, expires_at")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  // Get team name
  const { data: team } = await serviceSupabase
    .from("teams")
    .select("name, owner_id")
    .eq("id", invite.team_id)
    .single();

  // Get owner profile
  let inviterName = "Someone";
  if (team?.owner_id) {
    const { data: ownerProfile } = await serviceSupabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", team.owner_id)
      .single();

    if (ownerProfile) {
      inviterName = ownerProfile.full_name;
    }
  }

  return NextResponse.json({
    invite: {
      email: invite.email,
      role: invite.role,
      teamName: team?.name || "Unknown team",
      inviterName,
    },
  });
}

/**
 * POST /api/teams/invite/[token] — Accept an invite.
 * Requires the user to be logged in.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in to accept an invite" }, { status: 401 });
  }

  const serviceSupabase = await createServiceClient();

  const { data: invite, error } = await serviceSupabase
    .from("team_invites")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  // Verify the logged-in user's email matches the invite
  if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address" },
      { status: 403 }
    );
  }

  // Check if already a member
  const { data: existingMember } = await serviceSupabase
    .from("team_members")
    .select("id")
    .eq("team_id", invite.team_id)
    .eq("user_id", user.id)
    .single();

  if (existingMember) {
    // Already a member, delete the invite and return success
    await serviceSupabase.from("team_invites").delete().eq("id", invite.id);
    return NextResponse.json({ success: true, teamId: invite.team_id });
  }

  // Add user as team member
  const { error: memberError } = await serviceSupabase
    .from("team_members")
    .insert({
      team_id: invite.team_id,
      user_id: user.id,
      role: invite.role,
      invited_email: invite.email,
      accepted_at: new Date().toISOString(),
    });

  if (memberError) {
    console.error("Failed to add team member:", memberError);
    return NextResponse.json({ error: "Failed to join team" }, { status: 500 });
  }

  // Delete the invite
  await serviceSupabase.from("team_invites").delete().eq("id", invite.id);

  return NextResponse.json({ success: true, teamId: invite.team_id });
}
