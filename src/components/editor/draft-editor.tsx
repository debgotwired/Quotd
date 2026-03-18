"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Markdown } from "tiptap-markdown";
import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { EditorToolbar } from "./editor-toolbar";

type EditorMode = "wysiwyg" | "markdown";

interface DraftEditorProps {
  content: string;
  interviewId: string;
  readOnly?: boolean;
  saveUrl?: string;
}

export function DraftEditor({ content, interviewId, readOnly = false, saveUrl }: DraftEditorProps) {
  const [mode, setMode] = useState<EditorMode>("wysiwyg");
  const [markdownSource, setMarkdownSource] = useState(content);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debouncedSaveRef = useRef<(md: string) => void>(() => {});

  const saveDraft = useCallback(async (md: string) => {
    setSaveStatus("saving");
    try {
      const url = saveUrl || `/api/interviews/${interviewId}/draft`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: md }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveStatus("saved");
      if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);
      savedStatusTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }, [interviewId, saveUrl]);

  const debouncedSave = useCallback(
    (md: string) => {
      if (readOnly) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveStatus("idle");
      saveTimeoutRef.current = setTimeout(() => {
        saveDraft(md);
      }, 1500);
    },
    [readOnly, saveDraft]
  );

  // Keep ref fresh so Tiptap's onUpdate always calls the latest debouncedSave
  debouncedSaveRef.current = debouncedSave;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-gray-900 underline underline-offset-2" },
      }),
      Placeholder.configure({
        placeholder: "Start writing your case study...",
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "prose-editor outline-none min-h-[400px]",
      },
    },
    onUpdate: ({ editor: ed }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (ed.storage as any).markdown.getMarkdown() as string;
      setMarkdownSource(md);
      debouncedSaveRef.current(md);
    },
  });

  const handleManualSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const md = mode === "markdown" ? markdownSource : ((editor?.storage as any)?.markdown?.getMarkdown() as string || "");
    saveDraft(md);
  };

  const switchToWysiwyg = () => {
    if (editor) {
      editor.commands.setContent(markdownSource);
    }
    setMode("wysiwyg");
  };

  const switchToMarkdown = () => {
    if (editor) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMarkdownSource((editor.storage as any).markdown.getMarkdown() as string);
    }
    setMode("markdown");
  };

  const handleMarkdownChange = (value: string) => {
    setMarkdownSource(value);
    debouncedSave(value);
  };

  // Auto-resize textarea in markdown mode
  useEffect(() => {
    if (mode === "markdown" && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      el.style.height = Math.max(400, el.scrollHeight) + "px";
    }
  }, [mode, markdownSource]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);
    };
  }, []);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Toolbar area */}
      {!readOnly && (
        <div className="border-b border-gray-200 px-3 py-2 flex items-center justify-between gap-3 bg-gray-50/50">
          <div className="flex items-center gap-3 min-w-0">
            {mode === "wysiwyg" && <EditorToolbar editor={editor} />}
            {mode === "markdown" && (
              <span className="text-xs text-gray-400 font-mono">Markdown</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Save status */}
            <span className={cn(
              "text-xs transition-opacity",
              saveStatus === "idle" && "opacity-0",
              saveStatus === "saving" && "text-gray-400",
              saveStatus === "saved" && "text-green-600",
              saveStatus === "error" && "text-red-500",
            )}>
              {saveStatus === "saving" && "Saving..."}
              {saveStatus === "saved" && "Saved"}
              {saveStatus === "error" && "Save failed"}
            </span>

            {/* Mode toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={switchToWysiwyg}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  mode === "wysiwyg"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={switchToMarkdown}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  mode === "markdown"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                Markdown
              </button>
            </div>

            {/* Save button */}
            <button
              type="button"
              onClick={handleManualSave}
              className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Editor content */}
      <div className="p-6 sm:p-8">
        {mode === "wysiwyg" ? (
          <EditorContent editor={editor} />
        ) : (
          <textarea
            ref={textareaRef}
            value={markdownSource}
            onChange={(e) => handleMarkdownChange(e.target.value)}
            readOnly={readOnly}
            className="w-full min-h-[400px] font-mono text-sm text-gray-700 leading-relaxed resize-none outline-none bg-transparent"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}
