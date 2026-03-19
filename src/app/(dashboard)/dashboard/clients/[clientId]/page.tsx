"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ClientDetail = {
  id: string;
  team_id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  welcome_message: string | null;
  interview_count: number;
  status_breakdown: Record<string, number>;
};

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  // Form state
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");

  useEffect(() => {
    params.then((p) => setClientId(p.clientId));
  }, [params]);

  const loadClient = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);

    try {
      // Get team ID
      const teamsRes = await fetch("/api/teams");
      const teamsData = await teamsRes.json();

      if (!teamsData.teams || teamsData.teams.length === 0) {
        setError("No team found");
        setLoading(false);
        return;
      }

      const teamId = teamsData.teams[0].id;
      const res = await fetch(`/api/teams/${teamId}/clients/${clientId}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load client");
        setLoading(false);
        return;
      }

      setClient(data.client);
      setName(data.client.name);
      setPrimaryColor(data.client.primary_color || "");
      setWelcomeMessage(data.client.welcome_message || "");
    } catch {
      setError("Failed to load client");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  const handleSave = async () => {
    if (!client) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch(`/api/teams/${client.team_id}/clients/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          primary_color: primaryColor || null,
          welcome_message: welcomeMessage || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        setSaving(false);
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/teams/${client.team_id}/clients/${client.id}/logo`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Failed to upload logo");
        return;
      }
      if (data.logo_url) {
        setClient({ ...client, logo_url: data.logo_url });
      }
    } catch {
      setUploadError("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!client) return;
    setSaving(true);

    try {
      await fetch(`/api/teams/${client.team_id}/clients/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_url: null }),
      });
      setClient({ ...client, logo_url: null });
    } catch {
      setError("Failed to remove logo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!client) return;
    if (!confirm("Delete this client? Interviews will be unlinked but not deleted.")) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/teams/${client.team_id}/clients/${client.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete client");
        setDeleting(false);
        return;
      }

      router.push("/dashboard/clients");
    } catch {
      setError("Failed to delete client");
      setDeleting(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft": return "Waiting";
      case "in_progress": return "In progress";
      case "review_pending": return "Awaiting review";
      case "review_in_progress": return "Under review";
      case "review_complete": return "Review done";
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto">
        <Link href="/dashboard/clients" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          &larr; Back to Clients
        </Link>
        <div className="animate-pulse space-y-4 mt-8">
          <div className="h-6 bg-gray-100 rounded w-32" />
          <div className="h-40 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="max-w-md mx-auto">
        <Link href="/dashboard/clients" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          &larr; Back to Clients
        </Link>
        <div className="mt-8 text-gray-500">Client not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <Link href="/dashboard/clients" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
        &larr; Back to Clients
      </Link>

      <div className="mt-8">
        <h1 className="text-2xl font-semibold text-gray-900">{client.name}</h1>
        <p className="text-gray-500 text-sm mt-1">
          Edit client branding and settings.
        </p>
      </div>

      {error && (
        <div className="mt-4 p-3 text-sm text-gray-700 bg-gray-100 rounded-lg border border-gray-200">
          {error}
        </div>
      )}

      {/* Interview Stats */}
      {client.interview_count > 0 && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3">
            {client.interview_count} interview{client.interview_count !== 1 ? "s" : ""}
          </p>
          <div className="space-y-1">
            {Object.entries(client.status_breakdown).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{getStatusLabel(status)}</span>
                <span className="text-gray-900 font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-8">
        {/* Name */}
        <div>
          <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-2">
            Client name
          </label>
          <input
            id="clientName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
          />
        </div>

        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Client logo
          </label>
          {client.logo_url ? (
            <div className="flex items-center gap-4">
              <img
                src={client.logo_url}
                alt="Logo"
                className="w-16 h-16 object-contain rounded-lg border border-gray-200"
              />
              <div className="flex gap-2">
                <label className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer transition-colors">
                  Replace
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                <button
                  onClick={handleRemoveLogo}
                  className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
              <div className="text-center">
                {uploading ? (
                  <p className="text-sm text-gray-400">Uploading...</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">Click to upload</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPEG, WebP, or SVG. Max 2MB.</p>
                  </>
                )}
              </div>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploading} />
            </label>
          )}
          {uploadError && (
            <p className="text-xs text-red-500 mt-2">{uploadError}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Overrides your profile logo on interviews for this client.
          </p>
        </div>

        {/* Primary color */}
        <div>
          <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 mb-2">
            Brand color <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              id="primaryColor"
              value={primaryColor || "#1a1a1a"}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) setPrimaryColor(v);
              }}
              placeholder="#1a1a1a"
              className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            {primaryColor && (
              <button
                onClick={() => setPrimaryColor("")}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Overrides your profile brand color for this client.
          </p>
        </div>

        {/* Welcome message */}
        <div>
          <label htmlFor="welcomeMessage" className="block text-sm font-medium text-gray-700 mb-2">
            Welcome message <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="welcomeMessage"
            rows={3}
            placeholder="Thanks for taking the time to share your experience!"
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value.slice(0, 500))}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors resize-none"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Overrides your profile welcome message. {welcomeMessage.length}/500
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Danger Zone</h2>
        <p className="text-gray-500 text-sm mb-4">
          Deleting this client will unlink all its interviews but will not delete them.
        </p>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {deleting ? "Deleting..." : "Delete Client"}
        </button>
      </div>
    </div>
  );
}
