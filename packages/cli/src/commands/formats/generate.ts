import { Command } from "commander";
import { QuotdClient } from "../../client.js";

export const formatsGenerateCommand = new Command("generate")
  .description("Generate a format from an interview draft")
  .argument("<id>", "Interview ID")
  .requiredOption("--format <format>", "Format (linkedin|twitter|one_pager|sales_slide|quote_cards|email_blurb|all)")
  .action(async (id: string, opts) => {
    try {
      const client = new QuotdClient();
      console.log(`Generating ${opts.format} format...`);
      const result = await client.generateFormat(id, opts.format);
      console.log(JSON.stringify(result.data, null, 2));
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });
