import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".quotd");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export type Config = {
  api_key?: string;
  base_url?: string;
};

export function readConfig(): Config {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as Config;
  } catch {
    return {};
  }
}

export function writeConfig(config: Config): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function getConfigValue(key: string): string | undefined {
  const config = readConfig();
  return (config as Record<string, string | undefined>)[key];
}

export function setConfigValue(key: string, value: string): void {
  const config = readConfig();
  (config as Record<string, string>)[key] = value;
  writeConfig(config);
}
