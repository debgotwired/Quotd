import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "md";

  const supabase = await createServiceClient();

  // Try to find by share_token first, then by id
  let interview;
  const { data: byToken } = await supabase
    .from("interviews")
    .select("*")
    .eq("share_token", token)
    .single();

  if (byToken) {
    interview = byToken;
  } else {
    const { data: byId } = await supabase
      .from("interviews")
      .select("*")
      .eq("id", token)
      .single();
    interview = byId;
  }

  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  if (!interview.draft_content) {
    return NextResponse.json({ error: "No draft content available" }, { status: 400 });
  }

  const filename = `${interview.customer_company.replace(/[^a-zA-Z0-9]/g, "-")}-case-study`;
  const content = interview.draft_content;

  if (format === "md") {
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${filename}.md"`,
      },
    });
  }

  if (format === "txt") {
    // Strip markdown formatting for plain text
    const plainText = content
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^\s*[-*]\s+/gm, "• ")
      .replace(/^\s*>\s+/gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    return new NextResponse(plainText, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${filename}.txt"`,
      },
    });
  }

  if (format === "html") {
    // Basic markdown to HTML conversion
    let html = content
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
      .replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${interview.customer_company} Case Study</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
    h1 { font-size: 2em; margin-bottom: 0.5em; }
    h2 { font-size: 1.5em; margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h3 { font-size: 1.2em; margin-top: 1.2em; }
    blockquote { border-left: 3px solid #ccc; margin: 1em 0; padding-left: 1em; font-style: italic; color: #666; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
    ul { padding-left: 1.5em; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <p>${html}</p>
</body>
</html>`;

    return new NextResponse(fullHtml, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename="${filename}.html"`,
      },
    });
  }

  // Default to markdown
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/markdown",
      "Content-Disposition": `attachment; filename="${filename}.md"`,
    },
  });
}
