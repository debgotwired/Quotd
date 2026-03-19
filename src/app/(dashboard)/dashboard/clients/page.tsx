"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type ClientRow = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  interview_count: number;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Inline create form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get user's team
      const teamsRes = await fetch("/api/teams");
      const teamsData = await teamsRes.json();

      if (!teamsData.teams || teamsData.teams.length === 0) {
        setTeamId(null);
        setLoading(false);
        return;
      }

      const tid = teamsData.teams[0].id;
      setTeamId(tid);

      const res = await fetch(`/api/teams/${tid}/clients`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load clients");
        return;
      }

      setClients(data.clients || []);
    } catch {
      setError("Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`/api/teams/${teamId}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create client");
        setCreating(false);
        return;
      }

      setNewName("");
      setShowForm(false);
      await loadClients();
    } catch {
      setError("Failed to create client");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          &larr; Back
        </Link>
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!teamId) {
    return (
      <div className="space-y-8">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          &larr; Back
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-1">
            Create a team first to manage clients.
          </p>
        </div>
        <Link
          href="/dashboard/team"
          className="inline-block px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          Create Team
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
        &larr; Back
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage client workspaces with custom branding.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          New Client
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm text-gray-700 bg-gray-100 rounded-lg border border-gray-200">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Client name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
            className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {creating ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(false); setNewName(""); }}
            className="px-4 py-3 text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </form>
      )}

      {clients.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <p className="text-gray-500 mb-4">No clients yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-block px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Create your first client
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/dashboard/clients/${client.id}`}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                {client.logo_url ? (
                  <img
                    src={client.logo_url}
                    alt=""
                    className="w-8 h-8 object-contain rounded"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-500">
                      {client.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="font-medium text-gray-900 group-hover:text-black">
                  {client.name}
                </span>
                {client.primary_color && (
                  <div
                    className="w-4 h-4 rounded-full border border-gray-200"
                    style={{ backgroundColor: client.primary_color }}
                  />
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-sm text-gray-500">
                  {client.interview_count} interview{client.interview_count !== 1 ? "s" : ""}
                </span>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
