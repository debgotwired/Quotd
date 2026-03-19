import { Command } from "commander";
import { QuotdClient } from "../../client.js";

export const interviewsCreateCommand = new Command("create")
  .description("Create a new interview")
  .requiredOption("--company <company>", "Customer company name")
  .requiredOption("--product <product>", "Product name")
  .option("--tone <tone>", "Interview tone (formal|conversational|technical)")
  .option("--focus <focus>", "Interview focus (balanced|roi|technical|storytelling)")
  .option("--audience <audience>", "Target audience (general|c_suite|technical_buyer|end_user|board)")
  .option("--email <email>", "Customer email")
  .action(async (opts) => {
    try {
      const client = new QuotdClient();
      const result = await client.createInterview({
        customer_company: opts.company,
        product_name: opts.product,
        ...(opts.tone && { interview_tone: opts.tone }),
        ...(opts.focus && { interview_focus: opts.focus }),
        ...(opts.audience && { target_audience: opts.audience }),
        ...(opts.email && { customer_email: opts.email }),
      });

      const d = result.data;
      console.log("Interview created:");
      console.log(`  ID:     ${d.id}`);
      console.log(`  Token:  ${d.share_token}`);
      console.log(`  Status: ${d.status}`);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });
