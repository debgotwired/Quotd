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
  userId: string
): Promise<Branding> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("logo_url, primary_color, welcome_message, company_name")
    .eq("user_id", userId)
    .single();

  if (!profile) return DEFAULT_BRANDING;

  return {
    logo_url: profile.logo_url || null,
    primary_color: profile.primary_color || "#1a1a1a",
    welcome_message: profile.welcome_message || null,
    company_name: profile.company_name || "",
  };
}
