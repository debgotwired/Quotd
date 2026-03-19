export default async function SnoozeConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-7 h-7 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        {expired ? (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Link Expired
            </h1>
            <p className="text-gray-600">
              This snooze link is no longer valid. If you received a new
              reminder, use the link in that email instead.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Got It!
            </h1>
            <p className="text-gray-600">
              We&apos;ll follow up in a few days. You can review your case study
              anytime using the link in your original email.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
