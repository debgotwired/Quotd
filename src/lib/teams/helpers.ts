import type { SupabaseClient } from "@supabase/supabase-js";
import type { Team, TeamMember, TeamRole } from "@/lib/supabase/types";

/**
 * Get all teams a user belongs to.
 */
export async function getUserTeams(
  supabase: SupabaseClient,
  userId: string
): Promise<Team[]> {
  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const teamIds = memberships.map((m: { team_id: string }) => m.team_id);

  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .in("id", teamIds)
    .order("created_at", { ascending: false });

  return (teams as Team[]) || [];
}

/**
 * Get a user's first/primary team (most users will only have one).
 */
export async function getUserPrimaryTeam(
  supabase: SupabaseClient,
  userId: string
): Promise<Team | null> {
  const teams = await getUserTeams(supabase, userId);
  return teams[0] || null;
}

/**
 * Get the user's role in a specific team.
 */
export async function getTeamRole(
  supabase: SupabaseClient,
  teamId: string,
  userId: string
): Promise<TeamRole | null> {
  const { data: member } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  return (member as TeamMember | null)?.role || null;
}

/**
 * Check if the role allows editing (owner or editor).
 */
export function canEditTeam(role: TeamRole | null): boolean {
  return role === "owner" || role === "editor";
}

/**
 * Check if the role is owner.
 */
export function isTeamOwner(role: TeamRole | null): boolean {
  return role === "owner";
}

/**
 * Get all team IDs a user belongs to.
 */
export async function getUserTeamIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) {
    return [];
  }

  return memberships.map((m: { team_id: string }) => m.team_id);
}

/**
 * Generate a secure invite token.
 */
export function generateInviteToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
