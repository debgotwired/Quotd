import { Command } from "commander";
import { QuotdClient } from "../../client.js";

export const webhooksListCommand = new Command("list")
  .description("List webhooks")
  .action(async () => {
    try {
      const client = new QuotdClient();
      const result = await client.listWebhooks();

      if (result.data.length === 0) {
        console.log("No webhooks configured.");
        return;
      }

      for (const wh of result.data) {
        const active = (wh as { active?: boolean }).active ? "active" : "paused";
        console.log(`  ${wh.id}  ${(wh as { url?: string }).url}  [${active}]`);
      }
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });
