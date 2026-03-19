"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function generateShareToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

type ClientOption = {
  id: string;
  name: string;
};

export default function NewInterviewPage() {
  const [customerCompany, setCustomerCompany] = useState("");
  const [productName, setProductName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [linkedinProfileUrl, setLinkedinProfileUrl] = useState("");
  const [companyWebsiteUrl, setCompanyWebsiteUrl] = useState("");
  const [interviewTone, setInterviewTone] = useState("conversational");
  const [interviewFocus, setInterviewFocus] = useState("balanced");
  const [targetAudience, setTargetAudience] = useState("general");
  const [questionLimit, setQuestionLimit] = useState("15");
  const [teamId, setTeamId] = useState("");
  const [clientId, setClientId] = useState("");
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetch("/api/teams")
      .then((res) => res.json())
      .then((data) => {
        if (data.teams && data.teams.length > 0) {
          setTeams(data.teams);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch clients when team changes
  useEffect(() => {
    if (!teamId) {
      setClients([]);
      setClientId("");
      return;
    }

    fetch(`/api/teams/${teamId}/clients`)
      .then((res) => res.json())
      .then((data) => {
        if (data.clients) {
          setClients(data.clients.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
        } else {
          setClients([]);
        }
      })
      .catch(() => {
        setClients([]);
      });

    setClientId("");
  }, [teamId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("interviews")
      .insert({
        user_id: user.id,
        customer_company: customerCompany,
        product_name: productName,
        customer_email: customerEmail.trim() || null,
        linkedin_profile_url: linkedinProfileUrl.trim() || null,
        company_website_url: companyWebsiteUrl.trim() || null,
        interview_tone: interviewTone,
        interview_focus: interviewFocus,
        target_audience: targetAudience,
        question_limit: parseInt(questionLimit, 10),
        ...(teamId ? { team_id: teamId } : {}),
        ...(clientId ? { client_id: clientId } : {}),
        status: "draft",
        share_token: generateShareToken(),
        extraction_state: {
          metrics: [],
          quotes: [],
          facts: {},
          question_count: 0,
        },
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/dashboard/${data.id}`);
  };

  return (
    <div className="max-w-md mx-auto">
      <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
        &larr; Back
      </Link>

      <div className="mt-8">
        <h1 className="text-2xl font-semibold text-gray-900">New Interview</h1>
        <p className="text-gray-500 text-sm mt-1">Set up a case study interview</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {error && (
          <div className="p-3 text-sm text-gray-700 bg-gray-100 rounded-lg border border-gray-200">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="customerCompany" className="block text-sm font-medium text-gray-700 mb-2">
            Customer company
          </label>
          <input
            id="customerCompany"
            type="text"
            placeholder="Acme Inc."
            value={customerCompany}
            onChange={(e) => setCustomerCompany(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
          />
        </div>

        <div>
          <label htmlFor="productName" className="block text-sm font-medium text-gray-700 mb-2">
            Your product name
          </label>
          <input
            id="productName"
            type="text"
            placeholder="ProductName"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
          />
        </div>

        <div>
          <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-2">
            Customer email <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="customerEmail"
            type="email"
            placeholder="customer@company.com"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            If provided, the customer will be emailed when the draft is ready for review.
          </p>
        </div>

        <div>
          <label htmlFor="linkedinProfileUrl" className="block text-sm font-medium text-gray-700 mb-2">
            LinkedIn profile URL <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="linkedinProfileUrl"
            type="url"
            placeholder="https://linkedin.com/in/janedoe"
            value={linkedinProfileUrl}
            onChange={(e) => setLinkedinProfileUrl(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            The interviewee&apos;s LinkedIn profile — helps AI personalize questions.
          </p>
        </div>

        <div>
          <label htmlFor="companyWebsiteUrl" className="block text-sm font-medium text-gray-700 mb-2">
            Company website URL <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="companyWebsiteUrl"
            type="url"
            placeholder="https://acmecorp.com"
            value={companyWebsiteUrl}
            onChange={(e) => setCompanyWebsiteUrl(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            The customer&apos;s company website — helps AI understand their business.
          </p>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-4">Interview settings</p>

          <div className="space-y-4">
            <div>
              <label htmlFor="interviewTone" className="block text-sm text-gray-600 mb-1.5">
                Tone
              </label>
              <select
                id="interviewTone"
                value={interviewTone}
                onChange={(e) => setInterviewTone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
              >
                <option value="conversational">Conversational</option>
                <option value="formal">Formal</option>
                <option value="technical">Technical</option>
              </select>
            </div>

            <div>
              <label htmlFor="interviewFocus" className="block text-sm text-gray-600 mb-1.5">
                Focus
              </label>
              <select
                id="interviewFocus"
                value={interviewFocus}
                onChange={(e) => setInterviewFocus(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
              >
                <option value="balanced">Balanced</option>
                <option value="roi">ROI-heavy</option>
                <option value="technical">Technical depth</option>
                <option value="storytelling">Emotional storytelling</option>
              </select>
            </div>

            <div>
              <label htmlFor="targetAudience" className="block text-sm text-gray-600 mb-1.5">
                Target audience
              </label>
              <select
                id="targetAudience"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
              >
                <option value="general">General</option>
                <option value="c_suite">C-suite</option>
                <option value="technical_buyer">Technical buyer</option>
                <option value="end_user">End user</option>
                <option value="board">Board / investors</option>
              </select>
            </div>

            <div>
              <label htmlFor="questionLimit" className="block text-sm text-gray-600 mb-1.5">
                Questions
              </label>
              <select
                id="questionLimit"
                value={questionLimit}
                onChange={(e) => setQuestionLimit(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
              >
                <option value="10">~10 (quick)</option>
                <option value="15">~15 (standard)</option>
                <option value="20">~20 (deep dive)</option>
              </select>
            </div>
          </div>
        </div>

        {teams.length > 0 && (
          <div>
            <label htmlFor="teamId" className="block text-sm font-medium text-gray-700 mb-2">
              Team <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              id="teamId"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
            >
              <option value="">Personal (no team)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">
              Share this interview with your team members.
            </p>
          </div>
        )}

        {clients.length > 0 && (
          <div>
            <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-2">
              Client <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              id="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
            >
              <option value="">No client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">
              Use client-specific branding for this interview.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Creating..." : "Create"}
        </button>
      </form>
    </div>
  );
}
