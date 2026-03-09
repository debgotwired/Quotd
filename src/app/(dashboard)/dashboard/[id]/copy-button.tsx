"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
