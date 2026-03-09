"use client";

import { useState } from "react";
import type { Message } from "@/lib/supabase/types";

export function TranscriptToggle({ messages }: { messages: Message[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
        Transcript ({messages.length} messages)
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`p-4 rounded-lg ${
                message.role === "assistant"
                  ? "bg-gray-100"
                  : "bg-white border border-gray-200"
              }`}
            >
              <p className="text-xs text-gray-400 mb-2">
                {message.role === "assistant" ? "Interviewer" : "Customer"}
              </p>
              <p className="text-sm text-gray-700">{message.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
