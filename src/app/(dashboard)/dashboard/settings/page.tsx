"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#1a1a1a");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data.logo_url) setLogoUrl(data.logo_url);
        if (data.primary_color) setPrimaryColor(data.primary_color);
        if (data.welcome_message) setWelcomeMessage(data.welcome_message);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/profile/logo", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Failed to upload logo");
        return;
      }
      if (data.logo_url) setLogoUrl(data.logo_url);
    } catch {
      setUploadError("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setSaving(true);
    await fetch("/api/profile/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logo_url: null }),
    });
    setLogoUrl(null);
    setSaving(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await fetch("/api/profile/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primary_color: primaryColor,
        welcome_message: welcomeMessage || null,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto">
        <div className="animate-pulse space-y-4 mt-8">
          <div className="h-6 bg-gray-100 rounded w-32" />
          <div className="h-40 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
        &larr; Back
      </Link>

      <div className="mt-8">
        <h1 className="text-2xl font-semibold text-gray-900">Branding</h1>
        <p className="text-gray-500 text-sm mt-1">
          Customize how your interviews look to customers.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Company logo
          </label>
          {logoUrl ? (
            <div className="flex items-center gap-4">
              <img
                src={logoUrl}
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
            Displayed on interview pages, review pages, and emails.
          </p>
        </div>

        {/* Primary color */}
        <div>
          <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 mb-2">
            Brand color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              id="primaryColor"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setPrimaryColor(v);
              }}
              className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            <div
              className="h-10 flex-1 rounded-lg flex items-center justify-center text-white text-sm font-medium"
              style={{ backgroundColor: primaryColor }}
            >
              Preview
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Used for buttons and accents on customer-facing pages.
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
            Shown to customers when they open the interview link. {welcomeMessage.length}/500
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
    </div>
  );
}
