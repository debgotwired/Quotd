import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTeams } from "@/lib/teams/helpers";

/**
 * GET /api/teams — List all teams the current user belongs to.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teams = await getUserTeams(supabase, user.id);
  return NextResponse.json({ teams });
}

/**
 * POST /api/teams — Create a new team.
 * Body: { name: string }
 * The creating user becomes the owner.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }

  if (name.trim().length > 100) {
    return NextResponse.json({ error: "Team name must be 100 characters or less" }, { status: 400 });
  }

  // Check if user already owns a team (limit to 1 for now)
  const existingTeams = await getUserTeams(supabase, user.id);
  const ownsTeam = existingTeams.some((t) => t.owner_id === user.id);
  if (ownsTeam) {
    return NextResponse.json({ error: "You already own a team" }, { status: 400 });
  }

  // Create the team
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({ name: name.trim(), owner_id: user.id })
    .select()
    .single();

  if (teamError || !team) {
    console.error("Failed to create team:", teamError);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }

  // Add the creator as owner member
  const { error: memberError } = await supabase
    .from("team_members")
    .insert({
      team_id: team.id,
      user_id: user.id,
      role: "owner",
      accepted_at: new Date().toISOString(),
    });

  if (memberError) {
    console.error("Failed to add owner as member:", memberError);
    // Clean up the team if member insert fails
    await supabase.from("teams").delete().eq("id", team.id);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }

  return NextResponse.json({ team }, { status: 201 });
}
