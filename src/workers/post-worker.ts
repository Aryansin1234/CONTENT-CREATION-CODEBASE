import "dotenv/config";
import { Worker, Queue, Job } from "bullmq";
import { LinkedInPoster } from "../posting/linkedin";
import { InstagramPoster } from "../posting/instagram";
import { TwitterPoster } from "../posting/twitter";
import { supabase } from "../storage/supabase";
import { incrementPostCount } from "../monitoring/source-health";

const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || "6379", 10),
};

// Dead letter queue for exhausted jobs
const failedQueue = new Queue("failed-posts", { connection });

interface PostJobData {
  platform: "linkedin" | "instagram" | "twitter" | "threads";
  caption: string | string[];
  imageUrl?: string;
  pdfUrl?: string;
  urlHash?: string;
}

const worker = new Worker<PostJobData>(
  "social-posts",
  async (job: Job<PostJobData>) => {
    const { platform, caption, imageUrl } = job.data;
    console.log(`[worker] Processing job: ${job.name} (platform: ${platform})`);

    let result;

    switch (platform) {
      case "linkedin": {
        const poster = new LinkedInPoster();
        result = await poster.post(caption as string, imageUrl);
        break;
      }
      case "instagram": {
        if (!imageUrl) throw new Error("Instagram requires an imageUrl");
        const poster = new InstagramPoster();
        result = await poster.post(caption as string, imageUrl);
        break;
      }
      case "twitter": {
        const poster = new TwitterPoster();
        result = await poster.postThread(
          Array.isArray(caption) ? caption : [caption],
          imageUrl
        );
        break;
      }
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }

    await incrementPostCount(platform).catch(console.error);
    console.log(`[worker] Posted to ${platform}: ${result.url}`);
    return result;
  },
  { connection, concurrency: 3 }
);

worker.on("completed", (job, result) => {
  console.log(`[worker] Job ${job.name} completed:`, result?.url);
});

worker.on("failed", async (job, err) => {
  console.error(`[worker] Job ${job?.name} failed:`, err.message);

  if (!job || job.attemptsMade < (job.opts.attempts ?? 3)) return;

  // All retries exhausted — move to dead letter queue
  await failedQueue.add("exhausted", {
    ...job.data,
    error: err.message,
    failedAt: new Date().toISOString(),
  });

  // Store in Supabase for visibility — fire-and-forget
  void supabase.from("failed_posts").insert({
    platform: job.data.platform,
    caption: Array.isArray(job.data.caption) ? job.data.caption.join(" | ") : job.data.caption,
    image_url: job.data.imageUrl,
    error: err.message,
    job_data: job.data,
  });

  // Telegram alert
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (chatId && token) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Post failed after all retries\nPlatform: ${job.data.platform}\nError: ${err.message}\nRun: npm run cli -- failed-jobs list`,
      }),
    }).catch(console.error);
  }
});

console.log("[worker] BullMQ post worker started, waiting for jobs...");
