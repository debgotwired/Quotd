"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type InviteInfo = {
  email: string;
  role: string;
  teamName: string;
  inviterName: string;
};

export default function AcceptInvitePage() {
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // Check auth status
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);

      // Load invite details
      try {
        const res = await fetch(`/api/teams/invite/${token}`);
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 410) {
            setError("This invite has expired. Please ask the team owner for a new one.");
          } else {
            setError(data.error || "Invite not found");
          }
        } else {
          setInvite(data.invite);
        }
      } catch {
        setError("Failed to load invite");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token, supabase.auth]);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(`/api/teams/invite/${token}`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to accept invite");
        setAccepting(false);
        return;
      }

      router.push("/dashboard/team");
      router.refresh();
    } catch {
      setError("Failed to accept invite");
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-gray-500 text-sm">Loading invite...</div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Invalid Invite</h1>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <Link
            href="/dashboard"
            className="inline-block px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Team Invite</h1>
          <p className="text-gray-500 text-sm mt-2">
            <strong>{invite?.inviterName}</strong> invited you to join{" "}
            <strong>{invite?.teamName}</strong> as{" "}
            {invite?.role === "editor" ? "an" : "a"} <strong>{invite?.role}</strong>.
          </p>
        </div>

        {error && (
          <div className="p-3 text-sm text-gray-700 bg-gray-100 rounded-lg border border-gray-200 mb-6">
            {error}
          </div>
        )}

        {isLoggedIn ? (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {accepting ? "Joining..." : "Accept & Join Team"}
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 text-center">
              You need to sign in or create an account first.
            </p>
            <Link
              href={`/login?redirect=/invite/${token}`}
              className="block w-full py-3 px-4 bg-gray-900 text-white text-center font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Sign In to Accept
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
