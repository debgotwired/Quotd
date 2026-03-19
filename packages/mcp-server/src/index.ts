#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { QuotdClient } from "./client.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";

const apiKey = process.env.QUOTD_API_KEY;
if (!apiKey) {
  console.error("Error: QUOTD_API_KEY environment variable is required");
  process.exit(1);
}

const baseUrl = process.env.QUOTD_BASE_URL || "https://app.quotd.io";
const client = new QuotdClient(apiKey, baseUrl);

const server = new McpServer({
  name: "quotd",
  version: "0.1.0",
});

registerTools(server, client);
registerResources(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
