import { readFileSync } from "fs";
import { join } from "path";

const PROMPTS_DIR = join(__dirname, "../../prompts");
const cache = new Map<string, string>();

export function loadPrompt(name: string): string {
  if (cache.has(name)) return cache.get(name)!;
  const content = readFileSync(join(PROMPTS_DIR, name), "utf-8").trim();
  cache.set(name, content);
  return content;
}

export function clearPromptCache(): void {
  cache.clear();
}
