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
      // Bold
      text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
      // Italic
      text = text.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
      // Code
      text = text.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

      return <span dangerouslySetInnerHTML={{ __html: text }} />;
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
