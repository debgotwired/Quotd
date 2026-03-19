"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface DoneClientProps {
  token: string;
  productName: string;
  metricsCount: number;
  quotesCount: number;
  brandColor: string;
  logoUrl: string | null;
}

export function DoneClient({
  token,
  productName,
  metricsCount,
  quotesCount,
  brandColor,
  logoUrl,
}: DoneClientProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(4);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const reviewUrl = `/i/${token}/review`;

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          router.push(reviewUrl);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [router, reviewUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md text-center">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="w-14 h-14 object-contain mx-auto mb-6"
          />
        ) : (
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: brandColor }}
          >
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Thank You!
        </h1>
        <p className="text-gray-600 mb-6">
          Your interview for{" "}
          <span className="font-medium">{productName}</span> has been completed.
        </p>

        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="flex justify-center gap-8">
            <div>
              <p className="text-3xl font-semibold text-gray-900">
                {metricsCount}
              </p>
              <p className="text-sm text-gray-500">Metrics</p>
            </div>
            <div className="w-px bg-gray-200" />
            <div>
              <p className="text-3xl font-semibold text-gray-900">
                {quotesCount}
              </p>
              <p className="text-sm text-gray-500">Quotes</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Your case study is ready — redirecting to review in {countdown}...
        </p>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{
              backgroundColor: brandColor,
              width: `${((4 - countdown) / 4) * 100}%`,
            }}
          />
        </div>

        <a
          href={reviewUrl}
          className="inline-block w-full py-3 px-4 text-white font-medium rounded-lg hover:opacity-90 transition-colors text-center"
          style={{ backgroundColor: brandColor }}
        >
          Review Now
        </a>
      </div>
    </div>
  );
}
