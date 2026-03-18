"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function generateShareToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function NewInterviewPage() {
  const [customerCompany, setCustomerCompany] = useState("");
  const [productName, setProductName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

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
