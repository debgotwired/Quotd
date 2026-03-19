import { Command } from "commander";
import { QuotdClient } from "../../client.js";

export const webhooksCreateCommand = new Command("create")
  .description("Create a webhook")
  .requiredOption("--url <url>", "Webhook endpoint URL")
  .requiredOption("--events <events>", "Comma-separated list of events")
  .option("--secret <secret>", "Signing secret (auto-generated if not provided)")
  .action(async (opts) => {
    try {
      const client = new QuotdClient();
      const events = (opts.events as string).split(",").map((e: string) => e.trim());
      const result = await client.createWebhook({
        url: opts.url,
        events,
        ...(opts.secret && { secret: opts.secret }),
      });
      console.log("Webhook created:");
      console.log(JSON.stringify(result.data, null, 2));
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });
