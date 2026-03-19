import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { QuotdClient } from "./client.js";

export function registerTools(server: McpServer, client: QuotdClient) {
  server.tool(
    "list_interviews",
    "List interviews with optional status filter and pagination",
    {
      status: z.string().optional().describe("Filter by status"),
      page: z.number().optional().describe("Page number"),
    },
    async ({ status, page }) => {
      const result = await client.listInterviews({ status, page });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "get_interview",
    "Get full details of a specific interview",
    {
      id: z.string().describe("Interview ID"),
    },
    async ({ id }) => {
      const result = await client.getInterview(id);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result.data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "create_interview",
    "Create a new interview",
    {
      customer_company: z.string().describe("Customer company name"),
      product_name: z.string().describe("Product name"),
      customer_email: z.string().optional().describe("Customer email"),
      tone: z.string().optional().describe("Interview tone"),
      focus: z.string().optional().describe("Interview focus"),
      audience: z.string().optional().describe("Target audience"),
    },
    async ({ customer_company, product_name, customer_email, tone, focus, audience }) => {
      const result = await client.createInterview({
        customer_company,
        product_name,
        ...(customer_email && { customer_email }),
        ...(tone && { interview_tone: tone }),
        ...(focus && { interview_focus: focus }),
        ...(audience && { target_audience: audience }),
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result.data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "get_draft",
    "Get the draft case study content for an interview",
    {
      id: z.string().describe("Interview ID"),
    },
    async ({ id }) => {
      const result = await client.getDraft(id);
      return {
        content: [
          { type: "text" as const, text: result.data.draft_content },
        ],
      };
    }
  );

  server.tool(
    "get_messages",
    "Get the interview transcript/messages",
    {
      id: z.string().describe("Interview ID"),
    },
    async ({ id }) => {
      const result = await client.getMessages(id);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result.data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "get_analytics",
    "Get the extraction state (metrics, quotes, facts) for an interview",
    {
      id: z.string().describe("Interview ID"),
    },
    async ({ id }) => {
      const result = await client.getAnalytics(id);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result.data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "generate_format",
    "Generate a specific format from an interview draft",
    {
      id: z.string().describe("Interview ID"),
      format: z
        .string()
        .describe(
          "Format type: linkedin, twitter, one_pager, sales_slide, quote_cards, email_blurb, or all"
        ),
    },
    async ({ id, format }) => {
      const result = await client.generateFormat(id, format);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result.data, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "export_draft",
    "Export interview draft in a specific format",
    {
      id: z.string().describe("Interview ID"),
      format: z
        .string()
        .describe("Export format: md, docx, pdf, html, or txt"),
    },
    async ({ id, format }) => {
      const result = await client.exportDraft(id, format);
      return {
        content: [{ type: "text" as const, text: result.text }],
      };
    }
  );

  server.tool("list_teams", "List teams you belong to", {}, async () => {
    const result = await client.listTeams();
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result.data, null, 2) },
      ],
    };
  });

  server.tool("get_profile", "Get your profile information", {}, async () => {
    const result = await client.getProfile();
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result.data, null, 2) },
      ],
    };
  });
}
