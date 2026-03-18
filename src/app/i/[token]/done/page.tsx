import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getBrandingForInterview } from "@/lib/branding/get-branding";
import type { ExtractionState } from "@/lib/supabase/types";

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

  const branding = await getBrandingForInterview(supabase, interview.user_id);
  const extractionState = interview.extraction_state as ExtractionState | null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md text-center">
        {branding.logo_url ? (
          <img src={branding.logo_url} alt="" className="w-14 h-14 object-contain mx-auto mb-6" />
        ) : (
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: branding.primary_color }}>
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Thank You!</h1>
        <p className="text-gray-600 mb-6">
          Your interview for <span className="font-medium">{interview.product_name}</span> has been completed.
        </p>

        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="flex justify-center gap-8">
            <div>
              <p className="text-3xl font-semibold text-gray-900">{extractionState?.metrics?.length || 0}</p>
              <p className="text-sm text-gray-500">Metrics</p>
            </div>
            <div className="w-px bg-gray-200" />
            <div>
              <p className="text-3xl font-semibold text-gray-900">{extractionState?.quotes?.length || 0}</p>
              <p className="text-sm text-gray-500">Quotes</p>
            </div>
          </div>
        </div>

        <Link
          href={`/i/${token}/review`}
          className="inline-block w-full py-3 px-4 text-white font-medium rounded-lg hover:opacity-90 transition-colors text-center mb-4"
          style={{ backgroundColor: branding.primary_color }}
        >
          Review Your Case Study
        </Link>

        <p className="text-sm text-gray-500">
          Review and approve the draft before it gets published.
        </p>
      </div>
    </div>
  );
}
