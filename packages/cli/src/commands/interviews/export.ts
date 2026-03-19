import { Command } from "commander";
import fs from "fs";
import { QuotdClient } from "../../client.js";

export const interviewsExportCommand = new Command("export")
  .description("Export interview draft")
  .argument("<id>", "Interview ID")
  .option("--format <format>", "Export format (md|docx|pdf|html|txt)", "md")
  .option("--output <file>", "Output file path")
  .action(async (id: string, opts) => {
    try {
      const client = new QuotdClient();
      const result = await client.exportDraft(id, opts.format);

      if (opts.output) {
        fs.writeFileSync(opts.output, result.buffer);
        console.log(`Exported to ${opts.output}`);
      } else {
        // For text formats, print to stdout
        if (
          result.contentType.includes("text/") ||
          result.contentType.includes("markdown")
        ) {
          process.stdout.write(result.buffer.toString("utf-8"));
        } else {
          const defaultName = `interview-${id}.${opts.format}`;
          fs.writeFileSync(defaultName, result.buffer);
          console.log(`Exported to ${defaultName}`);
        }
      }
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });
