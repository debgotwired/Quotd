import { marked } from "marked";

interface ExportMeta {
  company: string;
  product: string;
}

export async function toHtml(
  markdown: string,
  meta: ExportMeta
): Promise<Buffer> {
  const body = await marked(markdown);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta.company)} Case Study</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 48px 24px;
      line-height: 1.7;
      color: #1a1a1a;
      font-size: 15px;
    }
    h1 { font-size: 2em; margin: 0 0 0.6em; font-weight: 700; letter-spacing: -0.02em; }
    h2 { font-size: 1.4em; margin: 1.8em 0 0.5em; font-weight: 600; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
    h3 { font-size: 1.15em; margin: 1.4em 0 0.4em; font-weight: 600; }
    p { margin: 0 0 1em; }
    strong { font-weight: 600; }
    em { font-style: italic; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    blockquote {
      border-left: 3px solid #d4d4d8;
      margin: 1.2em 0;
      padding: 0.6em 1em;
      color: #52525b;
      font-style: italic;
      background: #fafafa;
      border-radius: 0 4px 4px 0;
    }
    blockquote p { margin: 0; }
    ul, ol { padding-left: 1.5em; margin: 0 0 1em; }
    li { margin: 0.3em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1.2em 0; font-size: 0.95em; }
    th, td { border: 1px solid #e5e5e5; padding: 10px 14px; text-align: left; }
    th { background: #f4f4f5; font-weight: 600; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 2em 0; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
${body}
</body>
</html>`;

  return Buffer.from(html, "utf-8");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
