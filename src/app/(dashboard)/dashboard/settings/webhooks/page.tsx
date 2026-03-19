"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const WEBHOOK_EVENTS = [
  "interview.created",
  "interview.completed",
  "review.started",
  "review.completed",
  "draft.generated",
  "format.generated",
  "reminder.sent",
] as const;

type WebhookItem = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
};

type DeliveryItem = {
  id: string;
  event: string;
  status_code: number | null;
  attempt: number;
  delivered_at: string | null;
  created_at: string;
};

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Delivery log state
  const [viewingDeliveries, setViewingDeliveries] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  async function fetchWebhooks() {
    try {
      const res = await fetch("/api/settings/webhooks");
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newUrl.trim() || newEvents.length === 0) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl.trim(),
          events: newEvents,
          ...(newSecret.trim() && { secret: newSecret.trim() }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create webhook");
        return;
      }
      setNewUrl("");
      setNewEvents([]);
      setNewSecret("");
      setShowForm(false);
      await fetchWebhooks();
    } catch {
      setError("Failed to create webhook");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(webhookId: string, active: boolean) {
    await fetch(`/api/settings/webhooks/${webhookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    await fetchWebhooks();
  }

  async function handleDelete(webhookId: string) {
    if (!confirm("Delete this webhook?")) return;
    await fetch(`/api/settings/webhooks/${webhookId}`, { method: "DELETE" });
    await fetchWebhooks();
  }

  async function handleTest(webhookId: string) {
    const res = await fetch("/api/settings/webhooks/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhook_id: webhookId }),
    });
    const data = await res.json();
    if (data.success) {
      alert(`Test delivery successful (HTTP ${data.status_code})`);
    } else {
      alert(`Test delivery failed: ${data.error || `HTTP ${data.status_code}`}`);
    }
  }

  async function handleViewDeliveries(webhookId: string) {
    if (viewingDeliveries === webhookId) {
      setViewingDeliveries(null);
      return;
    }
    setViewingDeliveries(webhookId);
    setLoadingDeliveries(true);
    try {
      const res = await fetch(`/api/settings/webhooks/${webhookId}/deliveries`);
      const data = await res.json();
      setDeliveries(data.deliveries || []);
    } finally {
      setLoadingDeliveries(false);
    }
  }

  function toggleEvent(event: string) {
    setNewEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
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

      <div className="mt-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Webhooks</h1>
          <p className="text-gray-500 text-sm mt-1">Receive real-time event notifications.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          {showForm ? "Cancel" : "Add Webhook"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {/* Create form */}
      {showForm && (
        <div className="mt-6 p-4 border border-gray-200 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
            <input
              type="url"
              placeholder="https://example.com/webhooks"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
            <div className="grid grid-cols-2 gap-2">
              {WEBHOOK_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="rounded border-gray-300"
                  />
                  {event}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Secret <span className="text-gray-400 font-normal">(optional, auto-generated if blank)</span>
            </label>
            <input
              type="text"
              placeholder="Leave blank to auto-generate"
              value={newSecret}
              onChange={(e) => setNewSecret(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 font-mono"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !newUrl.trim() || newEvents.length === 0}
            className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "Creating..." : "Create Webhook"}
          </button>
        </div>
      )}

      {/* Webhook list */}
      <div className="mt-8 space-y-3">
        {webhooks.length === 0 ? (
          <p className="text-sm text-gray-400">No webhooks configured.</p>
        ) : (
          webhooks.map((wh) => (
            <div key={wh.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{wh.url}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {wh.events.join(", ")}
                    </p>
                  </div>
                  <span
                    className={`ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      wh.active
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {wh.active ? "Active" : "Paused"}
                  </span>
                </div>

                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => handleToggle(wh.id, wh.active)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {wh.active ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => handleTest(wh.id)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => handleViewDeliveries(wh.id)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {viewingDeliveries === wh.id ? "Hide Log" : "View Log"}
                  </button>
                  <button
                    onClick={() => handleDelete(wh.id)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Delivery log */}
              {viewingDeliveries === wh.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  {loadingDeliveries ? (
                    <p className="text-xs text-gray-400">Loading...</p>
                  ) : deliveries.length === 0 ? (
                    <p className="text-xs text-gray-400">No deliveries yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {deliveries.map((d) => (
                        <div key={d.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                d.delivered_at ? "bg-green-400" : "bg-red-400"
                              }`}
                            />
                            <span className="text-gray-700">{d.event}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-400">
                            {d.status_code && <span>HTTP {d.status_code}</span>}
                            <span>Attempt {d.attempt}</span>
                            <span>{new Date(d.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
