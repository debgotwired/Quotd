import { Command } from "commander";
import { getConfigValue, setConfigValue, readConfig } from "../config.js";

export const configCommand = new Command("config")
  .description("Manage CLI configuration");

configCommand
  .command("set <key> <value>")
  .description("Set a config value (api_key, base_url)")
  .action((key: string, value: string) => {
    setConfigValue(key, value);
    console.log(`Set ${key} = ${key === "api_key" ? "***" : value}`);
  });

configCommand
  .command("get [key]")
  .description("Get a config value or list all")
  .action((key?: string) => {
    if (key) {
      const value = getConfigValue(key);
      if (key === "api_key" && value) {
        console.log(`${key} = ${value.slice(0, 12)}...`);
      } else {
        console.log(`${key} = ${value ?? "(not set)"}`);
      }
    } else {
      const config = readConfig();
      for (const [k, v] of Object.entries(config)) {
        if (k === "api_key" && v) {
          console.log(`${k} = ${(v as string).slice(0, 12)}...`);
        } else {
          console.log(`${k} = ${v}`);
        }
      }
    }
  });
