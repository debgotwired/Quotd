import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getUserTeams } from "@/lib/teams/helpers";

export const GET = withApiAuth(async (_req, { userId }) => {
  const supabase = await createServiceClient();
  const teams = await getUserTeams(supabase, userId);
  return NextResponse.json({ data: teams });
});

export const POST = withApiAuth(async (req, { userId }) => {
  let body: { name: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }
  if (name.trim().length > 100) {
    return NextResponse.json({ error: "Team name must be 100 characters or less" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const existingTeams = await getUserTeams(supabase, userId);
  const ownsTeam = existingTeams.some((t) => t.owner_id === userId);
  if (ownsTeam) {
    return NextResponse.json({ error: "You already own a team" }, { status: 400 });
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({ name: name.trim(), owner_id: userId })
    .select()
    .single();

  if (teamError || !team) {
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }

  const { error: memberError } = await supabase
    .from("team_members")
    .insert({
      team_id: team.id,
      user_id: userId,
      role: "owner",
      accepted_at: new Date().toISOString(),
    });

  if (memberError) {
    await supabase.from("teams").delete().eq("id", team.id);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }

  return NextResponse.json({ data: team }, { status: 201 });
});
