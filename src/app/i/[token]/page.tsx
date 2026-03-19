import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { isInterviewDone } from "@/lib/review/helpers";
import { getBrandingForInterview } from "@/lib/branding/get-branding";
import { TrackOpened } from "@/components/interview/track-opened";

export default async function InterviewWelcomePage({
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

  // Fetch messages to check if user is resuming
  const { data: messages } = await supabase
    .from("messages")
    .select("id, role")
    .eq("interview_id", interview.id)
    .order("created_at", { ascending: true });

  const isResuming = (messages?.length ?? 0) > 0 && interview.status === "in_progress";
  const questionCount = messages?.filter((m) => m.role === "user").length ?? 0;

  if (isInterviewDone(interview.status)) {
    if (interview.status === "review_complete") {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white px-4">
          <div className="w-full max-w-md text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Review Submitted</h1>
            <p className="text-gray-500">Thank you! Your review has been submitted.</p>
          </div>
        </div>
      );
    }

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
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Interview Completed</h1>
          <p className="text-gray-500 mb-6">Your case study draft is ready for review.</p>
          <Link href={`/i/${token}/review`}>
            <Button size="lg" className="w-full h-12 text-base text-white hover:opacity-90" style={{ backgroundColor: branding.primary_color }}>
              Review Your Case Study
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <TrackOpened token={token} />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt="" className="w-14 h-14 object-contain mx-auto mb-6" />
          ) : (
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              {isResuming ? (
                <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              )}
            </div>
          )}
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            {isResuming ? "Welcome Back" : "Case Study Interview"}
          </h1>
          <p className="text-gray-500">
            {isResuming ? (
              <>Continue your interview about <span className="font-medium text-gray-900">{interview.product_name}</span></>
            ) : (
              <>Share your experience with <span className="font-medium text-gray-900">{interview.product_name}</span></>
            )}
          </p>
        </div>

        {isResuming ? (
          <div className="bg-gray-50 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-gray-900">Your Progress</h2>
              <span className="text-sm text-gray-500">{questionCount}/{interview.question_limit ?? 15} questions</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min((questionCount / (interview.question_limit ?? 15)) * 100, 100)}%`, backgroundColor: branding.primary_color }}
              />
            </div>
            <p className="text-sm text-gray-500">
              You&apos;ve answered {questionCount} question{questionCount !== 1 ? "s" : ""}. Pick up right where you left off.
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-6 mb-8">
            <h2 className="font-medium text-gray-900 mb-4">What to expect</h2>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-gray-600">1</span>
                </div>
                <span>~{interview.question_limit ?? 15} quick questions about your experience</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-gray-600">2</span>
                </div>
                <span>Speak or type your answers - voice is primary</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-gray-600">3</span>
                </div>
                <span>Conversational format - just like chatting</span>
              </li>
            </ul>
          </div>
        )}

        {branding.welcome_message && !isResuming && (
          <div className="bg-gray-50 rounded-xl p-5 mb-8">
            <p className="text-sm text-gray-600">{branding.welcome_message}</p>
          </div>
        )}

        <div className="text-center">
          <p className="text-xs text-gray-400 mb-4">
            From: {branding.company_name || interview.customer_company}
          </p>
          <Link href={`/i/${token}/q`}>
            <Button size="lg" className="w-full h-12 text-base text-white hover:opacity-90" style={{ backgroundColor: branding.primary_color }}>
              {isResuming ? "Continue Interview" : "Start Interview"}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
