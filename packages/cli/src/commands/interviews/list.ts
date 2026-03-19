import { Command } from "commander";
import { QuotdClient } from "../../client.js";

export const interviewsListCommand = new Command("list")
  .description("List interviews")
  .option("--status <status>", "Filter by status")
  .option("--page <page>", "Page number", "1")
  .action(async (opts) => {
    try {
      const client = new QuotdClient();
      const result = await client.listInterviews({
        status: opts.status,
        page: parseInt(opts.page, 10),
      });

      if (result.data.length === 0) {
        console.log("No interviews found.");
        return;
      }

      console.log(
        `Showing page ${result.pagination.page} of ${result.pagination.total_pages} (${result.pagination.total} total)\n`
      );

      for (const interview of result.data) {
        const date = new Date(interview.created_at).toLocaleDateString();
        console.log(
          `  ${interview.id}  ${interview.customer_company.padEnd(30)}  ${interview.status.padEnd(18)}  ${date}`
        );
      }
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });
