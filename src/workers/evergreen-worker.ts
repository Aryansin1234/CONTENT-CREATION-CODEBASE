import "dotenv/config";
import cron from "node-cron";
import OpenAI from "openai";
import { supabase } from "../storage/supabase";
import { loadPrompt } from "../utils/prompts";
import { Queue } from "bullmq";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");
const connection = { host: redisUrl.hostname, port: parseInt(redisUrl.port || "6379", 10) };
const postQueue = new Queue("social-posts", { connection });

async function recycleEvergreens(): Promise<void> {
  console.log("[evergreen-worker] Checking for evergreen content to recycle...");

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const { data: oldPosts } = await supabase
    .from("post_results")
    .select("id, platform, post_id, article_id, processed_articles(title, content_type)")
    .lte("posted_at", cutoff.toISOString())
    .limit(5);

  if (!oldPosts?.length) {
    console.log("[evergreen-worker] No evergreen posts found");
    return;
  }

  // Filter to tutorials only
  const tutorials = (oldPosts as any[]).filter(
    (p) => p.processed_articles?.content_type === "tutorial"
  );

  for (const post of tutorials) {
    const title = post.processed_articles?.title ?? "this post";
    const toneProfile = loadPrompt("tone-profile.txt");

    const freshRes = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Write a fresh LinkedIn hook (1-2 sentences) for an old tutorial that's being reshared.
Start with "Worth revisiting:" or "Still relevant:". Be specific about what's still timely.
${toneProfile.includes("[PASTE YOUR POSTS HERE]") ? "" : `Voice: ${toneProfile.slice(0, 300)}`}`,
        },
        { role: "user", content: `Original title: ${title}` },
      ],
    });

    const newHook = freshRes.choices[0].message.content!;

    // Queue for posting on Sunday at 10am (low-traffic slot)
    const sunday = new Date();
    sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7));
    sunday.setHours(10, 0, 0, 0);
    const delay = Math.max(0, sunday.getTime() - Date.now());

    await postQueue.add(
      `evergreen-linkedin-${post.article_id}`,
      { platform: "linkedin", caption: newHook, urlHash: null },
      { delay, attempts: 3, backoff: { type: "exponential", delay: 5000 } }
    );

    console.log(`[evergreen-worker] Queued recycled post: "${title.slice(0, 40)}..."`);
  }
}

// Sunday at 8am — process before 10am posting slot
cron.schedule("0 8 * * 0", recycleEvergreens);
console.log("[evergreen-worker] Scheduled: Sundays at 8am");

if (process.argv.includes("--now")) recycleEvergreens();
