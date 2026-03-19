import { Command } from "commander";
import { QuotdClient } from "../../client.js";

export const teamsListCommand = new Command("list")
  .description("List your teams")
  .action(async () => {
    try {
      const client = new QuotdClient();
      const result = await client.listTeams();

      if (result.data.length === 0) {
        console.log("No teams found.");
        return;
      }

      for (const team of result.data) {
        console.log(`  ${team.id}  ${team.name}`);
      }
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });
