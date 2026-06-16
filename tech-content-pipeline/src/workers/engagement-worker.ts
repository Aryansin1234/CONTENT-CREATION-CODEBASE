import "dotenv/config";
import { Worker, Queue, Job } from "bullmq";
import OpenAI from "openai";
import { loadPrompt } from "../utils/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");
const connection = { host: redisUrl.hostname, port: parseInt(redisUrl.port || "6379", 10) };

interface EngagementJobData {
  platform: string;
  postId: string;
  postUrl: string;
}

const worker = new Worker<EngagementJobData>(
  "check-engagement",
  async (job: Job<EngagementJobData>) => {
    const { platform, postId } = job.data;
    console.log(`[engagement-worker] Checking comments on ${platform}:${postId}`);

    const comments = await fetchComments(platform, postId);
    if (!comments.length) return;

    const toneProfile = loadPrompt("tone-profile.txt");
    const chatId = process.env.TELEGRAM_CHAT_ID!;
    const token = process.env.TELEGRAM_BOT_TOKEN!;

    for (const comment of comments.slice(0, 3)) {
      const replyRes = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Draft a reply to this ${platform} comment. Be warm, specific, and add value. 1-2 sentences max.
${toneProfile.includes("[PASTE YOUR POSTS HERE]") ? "" : `Voice: ${toneProfile.slice(0, 300)}`}`,
          },
          { role: "user", content: `Comment from @${comment.author}: "${comment.text}"` },
        ],
      });

      const suggestedReply = replyRes.choices[0].message.content!;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `New comment on ${platform}\nFrom: @${comment.author}\n"${comment.text}"\n\nSuggested reply:\n"${suggestedReply}"\n\nReply 'send ${comment.id}' to post it, or ignore to skip.`,
        }),
      });
    }
  },
  { connection, concurrency: 2 }
);

async function fetchComments(platform: string, postId: string): Promise<Array<{ id: string; author: string; text: string }>> {
  try {
    if (platform === "linkedin") {
      const token = process.env.LINKEDIN_ACCESS_TOKEN!;
      const res = await fetch(
        `https://api.linkedin.com/v2/socialActions/${postId}/comments`,
        { headers: { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0" } }
      );
      if (!res.ok) return [];
      const data = await res.json() as any;
      return (data.elements ?? []).slice(0, 3).map((c: any) => ({
        id: c.$URN,
        author: c.actor ?? "unknown",
        text: c.message?.text ?? "",
      }));
    }
    if (platform === "twitter") {
      const token = process.env.TWITTER_ACCESS_TOKEN!;
      const res = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${postId}&tweet.fields=author_id,text&max_results=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return [];
      const data = await res.json() as any;
      return (data.data ?? []).map((t: any) => ({
        id: t.id,
        author: t.author_id,
        text: t.text,
      }));
    }
  } catch { /* non-fatal */ }
  return [];
}

worker.on("completed", (job) => console.log(`[engagement-worker] Job ${job.name} done`));
worker.on("failed", (job, err) => console.error(`[engagement-worker] ${job?.name} failed:`, err.message));
console.log("[engagement-worker] Started, watching check-engagement queue...");
