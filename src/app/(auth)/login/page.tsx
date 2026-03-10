"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Step = "email" | "code";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first code input when step changes to code
  useEffect(() => {
    if (step === "code" && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send code");
        setLoading(false);
        return;
      }

      setStep("code");
    } catch {
      setError("Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (value && index === 5 && newCode.every((d) => d)) {
      handleVerifyOtp(newCode.join(""));
    }
  };

  const handleCodeKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split("");
      setCode(digits);
      inputRefs.current[5]?.focus();
      handleVerifyOtp(pastedData);
    }
  };

  const handleVerifyOtp = async (codeString?: string) => {
    const finalCode = codeString || code.join("");
    if (finalCode.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Verify OTP - this also creates the session
      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: finalCode }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setError(verifyData.error || "Invalid code");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      // Redirect based on whether user needs onboarding
      if (verifyData.needsOnboarding) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch {
      setError("Failed to verify code. Please try again.");
      setLoading(false);
    }
  };

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerifyOtp();
  };

  const handleResendCode = async () => {
    setLoading(true);
    setError(null);
    setCode(["", "", "", "", "", ""]);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to resend code");
      }
    } catch {
      setError("Failed to resend code");
    } finally {
      setLoading(false);
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        {step === "email" ? (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
              <p className="text-gray-500 text-sm mt-1">
                Enter your email to receive a login code
              </p>
            </div>

            <form onSubmit={handleSendOtp} className="space-y-5">
              {error && (
                <div className="p-3 text-sm text-gray-700 bg-gray-100 rounded-lg border border-gray-200">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Sending code..." : "Continue"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-gray-900">
                Check your email
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                We sent a code to {email}
              </p>
            </div>

            <form onSubmit={handleSubmitCode} className="space-y-5">
              {error && (
                <div className="p-3 text-sm text-gray-700 bg-gray-100 rounded-lg border border-gray-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Enter code
                </label>
                <div
                  className="flex gap-2 justify-between"
                  onPaste={handleCodePaste}
                >
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(index, e)}
                      disabled={loading}
                      className="w-12 h-14 text-center text-xl font-semibold border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors disabled:opacity-50"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || code.some((d) => !d)}
                className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Verifying..." : "Sign in"}
              </button>

              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCode(["", "", "", "", "", ""]);
                    setError(null);
                  }}
                  className="text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Use different email
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
