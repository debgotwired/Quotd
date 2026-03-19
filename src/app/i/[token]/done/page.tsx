import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getBrandingForInterview } from "@/lib/branding/get-branding";
import type { ExtractionState } from "@/lib/supabase/types";
import { DoneClient } from "./done-client";

export default async function InterviewDonePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("share_token", token)
    .single();

  if (error || !interview) {
    notFound();
  }

  const branding = await getBrandingForInterview(supabase, interview.user_id, interview.client_id);
  const extractionState = interview.extraction_state as ExtractionState | null;

  return (
    <DoneClient
      token={token}
      productName={interview.product_name}
      metricsCount={extractionState?.metrics?.length || 0}
      quotesCount={extractionState?.quotes?.length || 0}
      brandColor={branding.primary_color}
      logoUrl={branding.logo_url}
    />
  );
}
