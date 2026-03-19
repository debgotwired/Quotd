import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, ClientWithStats, InterviewStatus } from "@/lib/supabase/types";

/**
 * Get all clients for a team.
 */
export async function getTeamClients(
  supabase: SupabaseClient,
  teamId: string
): Promise<Client[]> {
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("team_id", teamId)
    .order("name", { ascending: true });

  return (clients as Client[]) || [];
}

/**
 * Get a single client with interview stats.
 */
export async function getClientWithStats(
  supabase: SupabaseClient,
  clientId: string
): Promise<ClientWithStats | null> {
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (!client) return null;

  const { data: interviews } = await supabase
    .from("interviews")
    .select("status")
    .eq("client_id", clientId);

  const statusBreakdown: Record<string, number> = {};
  let interviewCount = 0;

  for (const interview of interviews || []) {
    const status = interview.status as InterviewStatus;
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    interviewCount++;
  }

  return {
    ...(client as Client),
    interview_count: interviewCount,
    status_breakdown: statusBreakdown,
  };
}
