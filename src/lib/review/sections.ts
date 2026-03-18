export type MarkdownSection = {
  heading: string;
  content: string;
};

/**
 * Splits markdown into sections by H2 (`## ...`) headings.
 * If there are no H2 headings, the whole document is one section
 * with the heading "Full Document".
 */
export function splitMarkdownIntoSections(md: string): MarkdownSection[] {
  if (!md || !md.trim()) {
    return [{ heading: "Full Document", content: "" }];
  }

  const lines = md.split("\n");
  const sections: MarkdownSection[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)/);
    if (match) {
      // Save previous section
      if (currentHeading !== null) {
        sections.push({
          heading: currentHeading,
          content: currentLines.join("\n").trim(),
        });
      } else if (currentLines.join("\n").trim()) {
        // Content before first H2 — treat as intro section
        sections.push({
          heading: "Introduction",
          content: currentLines.join("\n").trim(),
        });
      }
      currentHeading = match[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Push last section
  if (currentHeading !== null) {
    sections.push({
      heading: currentHeading,
      content: currentLines.join("\n").trim(),
    });
  } else {
    // No H2 headings at all
    sections.push({
      heading: "Full Document",
      content: md.trim(),
    });
  }

  return sections;
}
