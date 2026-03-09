import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
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

  const extractionState = interview.extraction_state as ExtractionState | null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
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

        <p className="text-sm text-gray-500">
          The team will be in touch if they need any additional information.
        </p>
      </div>
    </div>
  );
}
