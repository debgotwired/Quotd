import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeamRole, isTeamOwner, generateInviteToken } from "@/lib/teams/helpers";
import { sendTeamInviteEmail } from "@/lib/email/send";

/**
 * POST /api/teams/[teamId]/invite — Send an invite to join the team.
 * Body: { email: string, role: "editor" | "viewer" }
 * Owner only.
 */
export async function POST(
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
    return NextResponse.json({ error: "Only the team owner can send invites" }, { status: 403 });
  }

  const body = await request.json();
  const { email, role: inviteRole } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  if (!inviteRole || !["editor", "viewer"].includes(inviteRole)) {
    return NextResponse.json({ error: "Role must be 'editor' or 'viewer'" }, { status: 400 });
  }

  // Check if already a member by invited_email
  const { data: existingByEmail } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("invited_email", email.toLowerCase())
    .single();

  if (existingByEmail) {
    return NextResponse.json({ error: "This user is already a team member" }, { status: 400 });
  }

  // Check for existing pending invite — replace it with a fresh one
  const { data: existingInvite } = await supabase
    .from("team_invites")
    .select("id")
    .eq("team_id", teamId)
    .eq("email", email.toLowerCase())
    .single();

  if (existingInvite) {
    await supabase.from("team_invites").delete().eq("id", existingInvite.id);
  }

  // Create invite
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const { error: inviteError } = await supabase
    .from("team_invites")
    .insert({
      team_id: teamId,
      email: email.toLowerCase(),
      role: inviteRole,
      token,
      expires_at: expiresAt,
    });

  if (inviteError) {
    console.error("Failed to create invite:", inviteError);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  // Get team name and inviter profile for the email
  const { data: team } = await supabase
    .from("teams")
    .select("name")
    .eq("id", teamId)
    .single();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .single();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteUrl = `${appUrl}/invite/${token}`;

  try {
    await sendTeamInviteEmail(
      email.toLowerCase(),
      team?.name || "A team",
      profile?.full_name || "Someone",
      inviteRole,
      inviteUrl
    );
  } catch (err) {
    console.error("Failed to send invite email:", err);
    // Don't fail the invite creation, the invite link still works
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
