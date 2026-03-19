import { Command } from "commander";
import { QuotdClient } from "../../client.js";

export const draftGetCommand = new Command("get")
  .description("Get the draft markdown for an interview")
  .argument("<id>", "Interview ID")
  .action(async (id: string) => {
    try {
      const client = new QuotdClient();
      const result = await client.getDraft(id);
      process.stdout.write(result.data.draft_content);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });
