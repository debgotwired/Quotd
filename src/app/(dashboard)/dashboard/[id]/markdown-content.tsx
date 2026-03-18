"use client";

import React from "react";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  // Simple markdown rendering - converts common patterns to HTML
  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactElement[] = [];
    let inTable = false;
    let tableRows: string[] = [];
    let listItems: string[] = [];
    let inList = false;

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-4 text-gray-700">
            {listItems.map((item, i) => (
              <li key={i}>{renderInline(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
      }
      inList = false;
    };

    const flushTable = () => {
      if (tableRows.length > 0) {
        const headerRow = tableRows[0].split("|").filter(Boolean).map((s) => s.trim());
        const dataRows = tableRows.slice(2).map((row) =>
          row.split("|").filter(Boolean).map((s) => s.trim())
        );

        elements.push(
          <div key={`table-${elements.length}`} className="my-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {headerRow.map((cell, i) => (
                    <th key={i} className="text-left py-2 px-3 font-medium text-gray-900">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {row.map((cell, j) => (
                      <td key={j} className="py-2 px-3 text-gray-700">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
      inTable = false;
    };

    const renderInline = (text: string): React.ReactNode => {
      // Split on bold, italic, and code patterns and return React elements
      const parts: React.ReactNode[] = [];
      let remaining = text;
      let partKey = 0;

      while (remaining.length > 0) {
        // Find the earliest match among bold, italic, code
        const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
        const italicMatch = remaining.match(/\*([^*]+)\*/);
        const codeMatch = remaining.match(/`([^`]+)`/);

        const matches = [
          boldMatch ? { type: "bold" as const, match: boldMatch } : null,
          italicMatch ? { type: "italic" as const, match: italicMatch } : null,
          codeMatch ? { type: "code" as const, match: codeMatch } : null,
        ]
          .filter((m): m is NonNullable<typeof m> => m !== null && m.match.index !== undefined)
          .sort((a, b) => a.match.index! - b.match.index!);

        if (matches.length === 0) {
          parts.push(remaining);
          break;
        }

        const first = matches[0];
        const idx = first.match.index!;

        // Add text before the match
        if (idx > 0) {
          parts.push(remaining.slice(0, idx));
        }

        // Add the formatted element
        const inner = first.match[1];
        if (first.type === "bold") {
          parts.push(<strong key={partKey++} className="font-semibold">{inner}</strong>);
        } else if (first.type === "italic") {
          parts.push(<em key={partKey++} className="italic">{inner}</em>);
        } else {
          parts.push(<code key={partKey++} className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">{inner}</code>);
        }

        remaining = remaining.slice(idx + first.match[0].length);
      }

      return <span>{parts}</span>;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Empty line
      if (trimmedLine === "") {
        flushList();
        if (inTable) flushTable();
        continue;
      }

      // Table detection
      if (trimmedLine.includes("|") && !trimmedLine.startsWith(">")) {
        flushList();
        inTable = true;
        tableRows.push(trimmedLine);
        continue;
      } else if (inTable) {
        flushTable();
      }

      // Headers
      if (trimmedLine.startsWith("# ")) {
        flushList();
        elements.push(
          <h1 key={`h1-${i}`} className="text-2xl font-bold text-gray-900 mt-6 mb-4 first:mt-0">
            {renderInline(trimmedLine.slice(2))}
          </h1>
        );
        continue;
      }

      if (trimmedLine.startsWith("## ")) {
        flushList();
        elements.push(
          <h2 key={`h2-${i}`} className="text-xl font-semibold text-gray-900 mt-8 mb-3 border-b border-gray-100 pb-2">
            {renderInline(trimmedLine.slice(3))}
          </h2>
        );
        continue;
      }

      if (trimmedLine.startsWith("### ")) {
        flushList();
        elements.push(
          <h3 key={`h3-${i}`} className="text-lg font-semibold text-gray-900 mt-6 mb-2">
            {renderInline(trimmedLine.slice(4))}
          </h3>
        );
        continue;
      }

      // Blockquote
      if (trimmedLine.startsWith("> ")) {
        flushList();
        elements.push(
          <blockquote key={`quote-${i}`} className="border-l-4 border-gray-300 pl-4 my-4 text-gray-600 italic">
            {renderInline(trimmedLine.slice(2))}
          </blockquote>
        );
        continue;
      }

      // Horizontal rule
      if (trimmedLine === "---" || trimmedLine === "***") {
        flushList();
        elements.push(<hr key={`hr-${i}`} className="my-8 border-gray-200" />);
        continue;
      }

      // List items
      if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
        inList = true;
        listItems.push(trimmedLine.slice(2));
        continue;
      }

      // Numbered list
      if (/^\d+\.\s/.test(trimmedLine)) {
        inList = true;
        listItems.push(trimmedLine.replace(/^\d+\.\s/, ""));
        continue;
      }

      // Regular paragraph
      flushList();
      elements.push(
        <p key={`p-${i}`} className="text-gray-700 leading-relaxed my-3">
          {renderInline(trimmedLine)}
        </p>
      );
    }

    flushList();
    flushTable();

    return elements;
  };

  return <div className="prose-custom">{renderMarkdown(content)}</div>;
}
