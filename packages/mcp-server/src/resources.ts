import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { QuotdClient } from "./client.js";

export function registerResources(server: McpServer, client: QuotdClient) {
  // Static resource: list of interviews
  server.resource(
    "interviews-list",
    "quotd://interviews",
    async () => {
      const result = await client.listInterviews({ per_page: 50 } as { status?: string; page?: number });
      return {
        contents: [
          {
            uri: "quotd://interviews",
            mimeType: "application/json",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    }
  );

  // Dynamic resource: single interview
  server.resource(
    "interview-detail",
    new ResourceTemplate("quotd://interviews/{id}", { list: undefined }),
    async (uri, params) => {
      const id = params.id as string;
      const result = await client.getInterview(id);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    }
  );

  // Dynamic resource: interview transcript
  server.resource(
    "interview-transcript",
    new ResourceTemplate("quotd://interviews/{id}/transcript", { list: undefined }),
    async (uri, params) => {
      const id = params.id as string;
      const result = await client.getMessages(id);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    }
  );

  // Dynamic resource: interview analytics
  server.resource(
    "interview-analytics",
    new ResourceTemplate("quotd://interviews/{id}/analytics", { list: undefined }),
    async (uri, params) => {
      const id = params.id as string;
      const result = await client.getAnalytics(id);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    }
  );

  // Static resource: profile
  server.resource(
    "profile",
    "quotd://profile",
    async () => {
      const result = await client.getProfile();
      return {
        contents: [
          {
            uri: "quotd://profile",
            mimeType: "application/json",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    }
  );
}
