import { Command } from "commander";
import { QuotdClient } from "../../client.js";

export const interviewsGetCommand = new Command("get")
  .description("Get interview details")
  .argument("<id>", "Interview ID")
  .action(async (id: string) => {
    try {
      const client = new QuotdClient();
      const result = await client.getInterview(id);
      console.log(JSON.stringify(result.data, null, 2));
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });
