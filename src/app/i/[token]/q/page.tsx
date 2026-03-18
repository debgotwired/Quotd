"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChatMessage } from "@/components/chat/chat-message";
import { VoiceFirstInput, type AttachedFile, type AudioData } from "@/components/chat/voice-first-input";

type Message = {
  id: string;
  role: "assistant" | "user";
  content: string;
  files?: AttachedFile[];
};

type InterviewData = {
  interview: {
    id: string;
    customer_company: string;
    product_name: string;
    category: string;
    status: string;
  };
  messages: Message[];
};

export default function InterviewChatPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResumeNotice, setShowResumeNotice] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const questionCount = messages.filter((m) => m.role === "assistant").length;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const fetchInterview = useCallback(async () => {
    const res = await fetch(`/api/interview/${token}`);
    if (!res.ok) {
      setError("Interview not found");
      setLoading(false);
      return null;
    }
    const data = await res.json();
    setInterview(data);
    setMessages(data.messages || []);

    if (data.interview.status === "completed") {
      router.push(`/i/${token}/done`);
      return null;
    }

    return data;
  }, [token, router]);

  const fetchNextQuestion = useCallback(async () => {
    setIsTyping(true);
    try {
      const res = await fetch(`/api/interview/${token}/next-question`, {
        method: "POST",
      });
      if (!res.ok) {
        setError("Failed to get next question");
        return;
      }
      const data = await res.json();

      // Add AI message
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.question,
      };
      setMessages((prev) => [...prev, aiMessage]);

      if (data.should_end) {
        setTimeout(() => router.push(`/i/${token}/done`), 1500);
      }
    } finally {
      setIsTyping(false);
    }
  }, [token, router]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const data = await fetchInterview();
      if (data && data.interview.status !== "completed") {
        // Check if user is resuming (has existing messages)
        const isResuming = data.messages && data.messages.length > 0;
        if (isResuming) {
          setShowResumeNotice(true);
          // Auto-hide the notice after 4 seconds
          setTimeout(() => setShowResumeNotice(false), 4000);
        }

        // Check if there's already a question asked
        const lastMessage = data.messages?.[data.messages.length - 1];
        if (!lastMessage || lastMessage.role !== "assistant") {
          await fetchNextQuestion();
        }
      }
      setLoading(false);
    };
    init();
  }, [fetchInterview, fetchNextQuestion]);

  const handleSendMessage = async (content: string, files?: AttachedFile[], audio?: AudioData) => {
    if ((!content.trim() && (!files || files.length === 0)) || submitting) return;

    // Optimistically add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      files,
    };
    setMessages((prev) => [...prev, userMessage]);
    setSubmitting(true);
    setError(null);
    setIsTyping(true);

    // Build answer text including file references
    let answerText = content.trim();
    if (files && files.length > 0) {
      const fileRefs = files.map(f => `[Attached: ${f.name}](${f.url})`).join("\n");
      answerText = answerText ? `${answerText}\n\n${fileRefs}` : fileRefs;
    }

    try {
      const res = await fetch(`/api/interview/${token}/submit-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: answerText,
          files,
          audioUrl: audio?.audioUrl,
          audioPath: audio?.audioPath,
        }),
      });

      if (!res.ok) {
        setError("Failed to submit answer. Please try again.");
        setSubmitting(false);
        setIsTyping(false);
        return;
      }

      const data = await res.json();

      if (data.should_end) {
        // Add final message
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.question || "Thank you! We've got everything we need for the case study.",
        };
        setMessages((prev) => [...prev, aiMessage]);
        setIsTyping(false);
        setTimeout(() => router.push(`/i/${token}/done`), 2000);
      } else {
        // Add next question
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.question,
        };
        setMessages((prev) => [...prev, aiMessage]);
        setIsTyping(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setIsTyping(false);
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !interview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-gray-900 font-medium mb-2">Interview Not Found</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-gray-900">
              {interview?.interview.product_name}
            </h1>
            <p className="text-xs text-gray-500">
              {interview?.interview.customer_company} Case Study
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {questionCount}/15
            </span>
            <div className="w-12 sm:w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-900 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((questionCount / 15) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {/* Resume notice */}
          {showResumeNotice && (
            <div className="bg-gray-100 rounded-lg px-4 py-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Welcome back!</p>
                  <p className="text-xs text-gray-500">Continuing from where you left off</p>
                </div>
              </div>
              <button
                onClick={() => setShowResumeNotice(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Welcome message if no messages yet */}
          {messages.length === 0 && !isTyping && (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">Starting interview...</p>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              files={message.files}
            />
          ))}

          {isTyping && (
            <ChatMessage role="assistant" content="" isTyping />
          )}

          {error && (
            <div className="text-center">
              <p className="text-sm text-red-600 bg-red-50 inline-block px-4 py-2 rounded-lg">
                {error}
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <div className="sticky bottom-0">
        <VoiceFirstInput
          onSend={handleSendMessage}
          disabled={submitting || isTyping}
        />
      </div>
    </div>
  );
}
