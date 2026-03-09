"use client";

import { cn } from "@/lib/utils";
import type { AttachedFile } from "./voice-first-input";

interface ChatMessageProps {
  role: "assistant" | "user";
  content: string;
  files?: AttachedFile[];
  isTyping?: boolean;
}

export function ChatMessage({ role, content, files, isTyping }: ChatMessageProps) {
  const isAssistant = role === "assistant";

  return (
    <div
      className={cn(
        "flex w-full",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3",
          isAssistant
            ? "bg-gray-100 text-gray-900 rounded-bl-md"
            : "bg-gray-900 text-white rounded-br-md"
        )}
      >
        {isTyping ? (
          <div className="flex items-center gap-1 py-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        ) : (
          <>
            {/* File attachments */}
            {files && files.length > 0 && (
              <div className={cn(
                "flex flex-wrap gap-2 mb-2",
                files.length === 1 && files[0].type.startsWith("image/") && "mb-3"
              )}>
                {files.map((file, index) => (
                  <FilePreview key={index} file={file} isUserMessage={!isAssistant} />
                ))}
              </div>
            )}
            {content && (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{content}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilePreview({ file, isUserMessage }: { file: AttachedFile; isUserMessage: boolean }) {
  const isImage = file.type.startsWith("image/");

  if (isImage) {
    return (
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <img
          src={file.url}
          alt={file.name}
          className="max-w-[240px] max-h-[180px] rounded-lg object-cover"
        />
      </a>
    );
  }

  // Non-image files
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
        isUserMessage
          ? "bg-gray-700 hover:bg-gray-600"
          : "bg-gray-200 hover:bg-gray-300"
      )}
    >
      <FileIcon className={cn(
        "w-4 h-4",
        isUserMessage ? "text-gray-300" : "text-gray-500"
      )} />
      <span className={cn(
        "truncate max-w-[150px]",
        isUserMessage ? "text-white" : "text-gray-700"
      )}>
        {file.name}
      </span>
    </a>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
