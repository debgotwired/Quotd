import { Command } from "commander";
import { QuotdClient } from "../../client.js";

export const webhooksDeleteCommand = new Command("delete")
  .description("Delete a webhook")
  .argument("<id>", "Webhook ID")
  .action(async (id: string) => {
    try {
      const client = new QuotdClient();
      await client.deleteWebhook(id);
      console.log("Webhook deleted.");
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });
