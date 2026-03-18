import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { toHtml } from "@/lib/export/to-html";
import { toDocx } from "@/lib/export/to-docx";
import { toPdf } from "@/lib/export/to-pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "md";

  const supabase = await createServiceClient();

  // Look up by share_token only — no ID fallback to prevent unauthorized access
  const { data: interview } = await supabase
    .from("interviews")
    .select("*")
    .eq("share_token", token)
    .single();

  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  if (!interview.draft_content) {
    return NextResponse.json({ error: "No draft content available" }, { status: 400 });
  }

  const filename = `${interview.customer_company.replace(/[^a-zA-Z0-9]/g, "-")}-case-study`;
  const content = interview.draft_content;
  const meta = {
    company: interview.customer_company,
    product: interview.product_name || interview.customer_company,
  };

  if (format === "md") {
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${filename}.md"`,
      },
    });
  }

  if (format === "txt") {
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
    const buffer = await toHtml(content, meta);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename="${filename}.html"`,
      },
    });
  }

  if (format === "docx") {
    const buffer = await toDocx(content, meta);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer = await toPdf(content, meta);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
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
