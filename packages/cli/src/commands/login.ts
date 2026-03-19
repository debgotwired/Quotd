import { Command } from "commander";
import { setConfigValue, readConfig } from "../config.js";
import * as readline from "readline";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export const loginCommand = new Command("login")
  .description("Authenticate with your Quotd API key")
  .action(async () => {
    const key = await prompt("Enter your API key (qtd_...): ");

    if (!key.startsWith("qtd_")) {
      console.error("Error: API key must start with qtd_");
      process.exit(1);
    }

    setConfigValue("api_key", key);

    const config = readConfig();
    const baseUrl = config.base_url || "https://app.quotd.io";
    console.log(`API key saved. Using ${baseUrl}`);
  });
