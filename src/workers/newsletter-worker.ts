import "dotenv/config";
import cron from "node-cron";
import Parser from "rss-parser";
import OpenAI from "openai";
import { supabase } from "../storage/supabase";
import { loadPrompt } from "../utils/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const rssParser = new Parser();

interface NewsletterConfig {
  provider: "beehiiv" | "convertkit" | "log";
  apiKey?: string;
  publicationId?: string;
}

async function sendNewsletter(): Promise<void> {
  console.log("[newsletter-worker] Generating weekly digest...");

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data: topArticles } = await supabase
    .from("processed_articles")
    .select("id, title, content_type, url_hash")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  if (!topArticles?.length) {
    console.log("[newsletter-worker] No articles this week — skipping");
    return;
  }

  const toneProfile = loadPrompt("tone-profile.txt");

  const digestRes = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Write a weekly tech newsletter digest. Structure:
1. One-paragraph intro (what was big in tech this week)
2. 5 article summaries (2-3 sentences each, conversational)
3. One original "my take" observation at the end
Keep the total under 600 words. No emojis. Newsletter-quality writing.
${toneProfile.includes("[PASTE YOUR POSTS HERE]") ? "" : `Voice: ${toneProfile.slice(0, 400)}`}`,
      },
      {
        role: "user",
        content: `Articles this week:\n${(topArticles as any[]).map((a, i) => `${i + 1}. ${a.title}`).join("\n")}`,
      },
    ],
  });

  const digest = digestRes.choices[0].message.content!;

  const config: NewsletterConfig = {
    provider: (process.env.NEWSLETTER_PROVIDER as NewsletterConfig["provider"]) ?? "log",
    apiKey: process.env.NEWSLETTER_API_KEY,
    publicationId: process.env.NEWSLETTER_PUBLICATION_ID,
  };

  if (config.provider === "log") {
    console.log("[newsletter-worker] Draft digest (set NEWSLETTER_PROVIDER to send):\n", digest);
    return;
  }

  if (config.provider === "beehiiv") {
    await fetch(`https://api.beehiiv.com/v2/publications/${config.publicationId}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: `This Week in Tech — ${new Date().toLocaleDateString()}`,
        content: digest,
        status: "draft",
      }),
    });
    console.log("[newsletter-worker] Draft created in Beehiiv");
  }
}

// Sunday at 7pm
cron.schedule("0 19 * * 0", sendNewsletter);
console.log("[newsletter-worker] Scheduled: Sundays at 7pm");

if (process.argv.includes("--now")) sendNewsletter();
