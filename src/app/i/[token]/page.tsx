import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

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

  // Fetch messages to check if user is resuming
  const { data: messages } = await supabase
    .from("messages")
    .select("id, role")
    .eq("interview_id", interview.id)
    .order("created_at", { ascending: true });

  const isResuming = (messages?.length ?? 0) > 0 && interview.status === "in_progress";
  const questionCount = messages?.filter((m) => m.role === "user").length ?? 0;

  if (interview.status === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Interview Completed</h1>
          <p className="text-gray-500">Thank you! This interview has already been completed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
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
              <span className="text-sm text-gray-500">{questionCount}/12 questions</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gray-900 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((questionCount / 12) * 100, 100)}%` }}
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
                <span>10-12 quick questions about your experience</span>
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

        <div className="text-center">
          <p className="text-xs text-gray-400 mb-4">
            From: {interview.customer_company}
          </p>
          <Link href={`/i/${token}/q`}>
            <Button size="lg" className="w-full h-12 text-base bg-gray-900 hover:bg-gray-800">
              {isResuming ? "Continue Interview" : "Start Interview"}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
