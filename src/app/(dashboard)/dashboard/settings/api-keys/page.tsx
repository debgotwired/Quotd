"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type ApiKeyItem = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    try {
      const res = await fetch("/api/settings/api-keys");
      const data = await res.json();
      setKeys(data.keys || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError(null);
    setShowNewKey(null);

    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create key");
        return;
      }
      setShowNewKey(data.key.key);
      setNewKeyName("");
      await fetchKeys();
    } catch {
      setError("Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    if (!confirm("Are you sure you want to revoke this API key? This cannot be undone.")) return;

    try {
      await fetch("/api/settings/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: keyId }),
      });
      await fetchKeys();
    } catch {
      setError("Failed to revoke key");
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="animate-pulse space-y-4 mt-8">
          <div className="h-6 bg-gray-100 rounded w-32" />
          <div className="h-40 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link href="/dashboard/settings" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
        &larr; Settings
      </Link>

      <div className="mt-8">
        <h1 className="text-2xl font-semibold text-gray-900">API Keys</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage API keys for programmatic access to Quotd.
        </p>
      </div>

      {/* Create new key */}
      <div className="mt-8 space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Key name (e.g. Production)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newKeyName.trim()}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "Creating..." : "Create Key"}
          </button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {showNewKey && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800 mb-1">API key created. Copy it now -- you will not see it again.</p>
            <code className="block text-xs bg-white border border-green-200 rounded p-2 font-mono text-green-900 break-all select-all">
              {showNewKey}
            </code>
          </div>
        )}
      </div>

      {/* Key list */}
      <div className="mt-8 space-y-3">
        {keys.length === 0 ? (
          <p className="text-sm text-gray-400">No API keys yet.</p>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{key.name}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{key.key_prefix}...</p>
                <p className="text-xs text-gray-400 mt-1">
                  Created {new Date(key.created_at).toLocaleDateString()}
                  {key.last_used_at && ` \u00b7 Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors"
              >
                Revoke
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
