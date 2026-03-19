import { Command } from "commander";
import { QuotdClient } from "../../client.js";

export const formatsListCommand = new Command("list")
  .description("List generated formats for an interview")
  .argument("<id>", "Interview ID")
  .action(async (id: string) => {
    try {
      const client = new QuotdClient();
      const result = await client.listFormats(id);
      const formats = result.data;

      if (Object.keys(formats).length === 0) {
        console.log("No formats generated yet.");
        return;
      }

      for (const [key, value] of Object.entries(formats)) {
        const v = value as { generated_at?: string; edited?: boolean };
        console.log(`  ${key.padEnd(15)} generated ${v.generated_at || "unknown"}${v.edited ? " (edited)" : ""}`);
      }
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });
