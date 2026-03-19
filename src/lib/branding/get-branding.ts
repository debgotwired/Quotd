import type { SupabaseClient } from "@supabase/supabase-js";
import type { Branding } from "@/lib/supabase/types";

const DEFAULT_BRANDING: Branding = {
  logo_url: null,
  primary_color: "#1a1a1a",
  welcome_message: null,
  company_name: "",
};

export async function getBrandingForInterview(
  supabase: SupabaseClient,
  userId: string,
  clientId?: string | null
): Promise<Branding> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("logo_url, primary_color, welcome_message, company_name")
    .eq("user_id", userId)
    .single();

  const profileBranding: Branding = profile
    ? {
        logo_url: profile.logo_url || null,
        primary_color: profile.primary_color || "#1a1a1a",
        welcome_message: profile.welcome_message || null,
        company_name: profile.company_name || "",
      }
    : DEFAULT_BRANDING;

  if (!clientId) return profileBranding;

  const { data: client } = await supabase
    .from("clients")
    .select("name, logo_url, primary_color, welcome_message")
    .eq("id", clientId)
    .single();

  if (!client) return profileBranding;

  return {
    logo_url: client.logo_url ?? profileBranding.logo_url,
    primary_color: client.primary_color ?? profileBranding.primary_color,
    welcome_message: client.welcome_message ?? profileBranding.welcome_message,
    company_name: client.name || profileBranding.company_name,
  };
}
