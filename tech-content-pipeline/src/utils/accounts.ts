import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface AccountCredentials {
  name: string;
  linkedin?: { access_token: string; person_id: string };
  twitter?: { api_key: string; api_secret: string; access_token: string; access_secret: string };
  instagram?: { user_id: string; access_token: string };
  tone_profile?: string;
}

export function loadAccount(name?: string): AccountCredentials {
  const path = join(process.cwd(), "accounts.json");

  if (!existsSync(path)) {
    // Fall back to env vars for backwards compatibility
    return {
      name: name ?? "default",
      linkedin: {
        access_token: process.env.LINKEDIN_ACCESS_TOKEN ?? "",
        person_id: process.env.LINKEDIN_PERSON_ID ?? "",
      },
      twitter: {
        api_key: process.env.TWITTER_API_KEY ?? "",
        api_secret: process.env.TWITTER_API_SECRET ?? "",
        access_token: process.env.TWITTER_ACCESS_TOKEN ?? "",
        access_secret: process.env.TWITTER_ACCESS_SECRET ?? "",
      },
      instagram: {
        user_id: process.env.INSTAGRAM_USER_ID ?? "",
        access_token: process.env.INSTAGRAM_ACCESS_TOKEN ?? "",
      },
    };
  }

  const accounts: AccountCredentials[] = JSON.parse(readFileSync(path, "utf-8"));
  const target = name
    ? accounts.find((a) => a.name === name)
    : accounts[0];

  if (!target) throw new Error(`Account "${name}" not found in accounts.json`);
  return target;
}

export function applyAccountToEnv(account: AccountCredentials): void {
  if (account.linkedin) {
    if (account.linkedin.access_token) process.env.LINKEDIN_ACCESS_TOKEN = account.linkedin.access_token;
    if (account.linkedin.person_id) process.env.LINKEDIN_PERSON_ID = account.linkedin.person_id;
  }
  if (account.twitter) {
    if (account.twitter.api_key) process.env.TWITTER_API_KEY = account.twitter.api_key;
    if (account.twitter.api_secret) process.env.TWITTER_API_SECRET = account.twitter.api_secret;
    if (account.twitter.access_token) process.env.TWITTER_ACCESS_TOKEN = account.twitter.access_token;
    if (account.twitter.access_secret) process.env.TWITTER_ACCESS_SECRET = account.twitter.access_secret;
  }
  if (account.instagram) {
    if (account.instagram.user_id) process.env.INSTAGRAM_USER_ID = account.instagram.user_id;
    if (account.instagram.access_token) process.env.INSTAGRAM_ACCESS_TOKEN = account.instagram.access_token;
  }
}
