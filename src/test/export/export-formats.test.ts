import { describe, it, expect } from "vitest";
import { toHtml } from "@/lib/export/to-html";
import { toDocx } from "@/lib/export/to-docx";
import { toPdf } from "@/lib/export/to-pdf";

const SAMPLE_MARKDOWN = `# TechFlow Solutions: A Quotd Case Study

## The Challenge

TechFlow Solutions, a **mid-size SaaS company** with *200+ employees*, was struggling to create compelling case studies. Their sales team needed professional content but lacked the resources.

> "We were spending weeks trying to get customers to sit down for interviews. By the time we had the content, the deal momentum was gone." — Sarah Chen, VP of Marketing

## Key Metrics

| Metric | Before | After |
|--------|--------|-------|
| Time to publish | 6 weeks | 2 days |
| Customer participation | 20% | 85% |
| Case studies per quarter | 2 | 12 |

## The Solution

TechFlow adopted Quotd to streamline their case study process:

- **Automated interviews** — AI-driven conversations that adapt to each customer
- **Draft generation** — Professional case studies generated in minutes
- *Seamless review* — Customers can review and approve with one click

### Implementation

The team rolled out Quotd in three phases:

1. Pilot with top 5 accounts
2. Expanded to all enterprise customers
3. Integrated with their CRM workflow

## Results

The impact was immediate. Within the first month:

- Case study production increased by \`600%\`
- Sales cycle shortened by 15 days
- Customer satisfaction scores improved

---

## About TechFlow Solutions

TechFlow Solutions provides cloud infrastructure management tools for growing SaaS companies. Founded in 2019, they serve over 500 customers globally.

For more information, visit their website.
`;

const META = { company: "TechFlow Solutions", product: "Quotd" };

describe("Export: to-html", () => {
  it("produces valid HTML with correct structure", async () => {
    const buffer = await toHtml(SAMPLE_MARKDOWN, META);
    const html = buffer.toString("utf-8");

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("<title>TechFlow Solutions Case Study</title>");
  });

  it("converts headings correctly", async () => {
    const buffer = await toHtml(SAMPLE_MARKDOWN, META);
    const html = buffer.toString("utf-8");

    expect(html).toContain("<h1>");
    expect(html).toContain("<h2>");
    expect(html).toContain("<h3>");
    expect(html).toContain("The Challenge");
    expect(html).toContain("Implementation");
  });

  it("preserves inline formatting", async () => {
    const buffer = await toHtml(SAMPLE_MARKDOWN, META);
    const html = buffer.toString("utf-8");

    expect(html).toContain("<strong>");
    expect(html).toContain("<em>");
    expect(html).toContain("<code>");
  });

  it("renders tables", async () => {
    const buffer = await toHtml(SAMPLE_MARKDOWN, META);
    const html = buffer.toString("utf-8");

    expect(html).toContain("<table>");
    expect(html).toContain("<th>");
    expect(html).toContain("6 weeks");
    expect(html).toContain("2 days");
  });

  it("renders blockquotes", async () => {
    const buffer = await toHtml(SAMPLE_MARKDOWN, META);
    const html = buffer.toString("utf-8");

    expect(html).toContain("<blockquote>");
    expect(html).toContain("Sarah Chen");
  });

  it("renders lists", async () => {
    const buffer = await toHtml(SAMPLE_MARKDOWN, META);
    const html = buffer.toString("utf-8");

    expect(html).toContain("<ul>");
    expect(html).toContain("<li>");
    expect(html).toContain("<ol>");
  });

  it("renders horizontal rules", async () => {
    const buffer = await toHtml(SAMPLE_MARKDOWN, META);
    const html = buffer.toString("utf-8");

    expect(html).toContain("<hr");
  });

  it("includes styling", async () => {
    const buffer = await toHtml(SAMPLE_MARKDOWN, META);
    const html = buffer.toString("utf-8");

    expect(html).toContain("<style>");
    expect(html).toContain("font-family");
    expect(html).toContain("max-width");
  });

  it("escapes HTML in title", async () => {
    const buffer = await toHtml("# Test", {
      company: 'Foo <script>alert("xss")</script>',
      product: "Bar",
    });
    const html = buffer.toString("utf-8");

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("returns a Buffer", async () => {
    const buffer = await toHtml(SAMPLE_MARKDOWN, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("Export: to-docx", () => {
  it("produces a valid DOCX buffer", async () => {
    const buffer = await toDocx(SAMPLE_MARKDOWN, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);

    // DOCX files are ZIP archives starting with PK signature
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });

  it("produces reasonably sized output", async () => {
    const buffer = await toDocx(SAMPLE_MARKDOWN, META);
    // Should be between 1KB and 500KB for this content
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.length).toBeLessThan(500_000);
  });

  it("handles empty markdown", async () => {
    const buffer = await toDocx("", META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // Still a valid ZIP
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it("handles heading-only markdown", async () => {
    const buffer = await toDocx("# Just a Title", META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles markdown with only a list", async () => {
    const md = `- Item one\n- Item two\n- Item three`;
    const buffer = await toDocx(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles markdown with only a table", async () => {
    const md = `| A | B |\n|---|---|\n| 1 | 2 |`;
    const buffer = await toDocx(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles ordered lists", async () => {
    const md = `1. First\n2. Second\n3. Third`;
    const buffer = await toDocx(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles blockquotes", async () => {
    const md = `> This is a quote\n> with multiple lines`;
    const buffer = await toDocx(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles code blocks", async () => {
    const md = "```\nconst x = 1;\n```";
    const buffer = await toDocx(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles horizontal rules", async () => {
    const md = `Some text\n\n---\n\nMore text`;
    const buffer = await toDocx(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles complex inline formatting", async () => {
    const md = `This has **bold**, *italic*, \`code\`, and **bold with *nested italic***.`;
    const buffer = await toDocx(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles special characters in company name", async () => {
    const buffer = await toDocx(SAMPLE_MARKDOWN, {
      company: "O'Reilly & Associates — Ltd.",
      product: "Test",
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("Export: to-pdf", () => {
  it("produces a valid PDF buffer", async () => {
    const buffer = await toPdf(SAMPLE_MARKDOWN, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);

    // PDF files start with %PDF
    const header = buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("produces reasonably sized output", async () => {
    const buffer = await toPdf(SAMPLE_MARKDOWN, META);
    // Should be between 1KB and 1MB for this content
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.length).toBeLessThan(1_000_000);
  });

  it("handles empty markdown", async () => {
    const buffer = await toPdf("", META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    const header = buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("handles heading-only markdown", async () => {
    const buffer = await toPdf("# Just a Title", META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    const header = buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("handles markdown with only a list", async () => {
    const md = `- Item one\n- Item two\n- Item three`;
    const buffer = await toPdf(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    const header = buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("handles markdown with only a table", async () => {
    const md = `| A | B |\n|---|---|\n| 1 | 2 |`;
    const buffer = await toPdf(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    const header = buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("handles ordered lists", async () => {
    const md = `1. First\n2. Second\n3. Third`;
    const buffer = await toPdf(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    const header = buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("handles blockquotes", async () => {
    const md = `> This is a quote\n> with multiple lines`;
    const buffer = await toPdf(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it("handles code blocks", async () => {
    const md = "```\nconst x = 1;\n```";
    const buffer = await toPdf(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it("handles horizontal rules", async () => {
    const md = `Some text\n\n---\n\nMore text`;
    const buffer = await toPdf(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it("handles complex inline formatting", async () => {
    const md = `This has **bold**, *italic*, \`code\`, and **bold with *nested italic***.`;
    const buffer = await toPdf(md, META);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it("handles special characters in company name", async () => {
    const buffer = await toPdf(SAMPLE_MARKDOWN, {
      company: "O'Reilly & Associates — Ltd.",
      product: "Test",
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    const header = buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });
});

describe("Export: cross-format consistency", () => {
  it("all formats produce non-empty buffers from the same input", async () => {
    const [html, docx, pdf] = await Promise.all([
      toHtml(SAMPLE_MARKDOWN, META),
      toDocx(SAMPLE_MARKDOWN, META),
      toPdf(SAMPLE_MARKDOWN, META),
    ]);

    expect(html.length).toBeGreaterThan(0);
    expect(docx.length).toBeGreaterThan(0);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it("all formats handle minimal markdown", async () => {
    const minimal = "Hello world";
    const [html, docx, pdf] = await Promise.all([
      toHtml(minimal, META),
      toDocx(minimal, META),
      toPdf(minimal, META),
    ]);

    expect(html.length).toBeGreaterThan(0);
    expect(docx.length).toBeGreaterThan(0);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it("all formats handle markdown with all element types", async () => {
    const kitchen = `# Heading 1
## Heading 2
### Heading 3

Regular paragraph with **bold** and *italic* and \`code\`.

> A blockquote here

- Unordered item
- Another item

1. Ordered item
2. Another

| Col A | Col B |
|-------|-------|
| val1  | val2  |

\`\`\`
code block
\`\`\`

---

Final paragraph.
`;
    const [html, docx, pdf] = await Promise.all([
      toHtml(kitchen, META),
      toDocx(kitchen, META),
      toPdf(kitchen, META),
    ]);

    expect(html.length).toBeGreaterThan(0);
    expect(docx.length).toBeGreaterThan(0);
    expect(pdf.length).toBeGreaterThan(0);
  });
});
