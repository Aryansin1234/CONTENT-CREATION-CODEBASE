import "dotenv/config";
import { Command } from "commander";
import { Queue } from "bullmq";
import { supabase } from "./storage/supabase";
import { buildPipeline } from "./pipeline/graph";
import { createHash } from "crypto";

const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");
const connection = { host: redisUrl.hostname, port: parseInt(redisUrl.port || "6379", 10) };

const program = new Command();

program
  .name("pipeline")
  .description("Tech Content Pipeline CLI")
  .version("1.0.0");

// ── stats ──────────────────────────────────────────────────────────────────
program
  .command("stats")
  .description("Show content calendar (queued, scheduled, posted)")
  .action(async () => {
    const postQueue = new Queue("social-posts", { connection });
    const waiting = await postQueue.getWaiting();
    const delayed = await postQueue.getDelayed();

    const { data: recentPosts } = await supabase
      .from("post_results")
      .select("platform, url, posted_at, article_id, processed_articles(title)")
      .order("posted_at", { ascending: false })
      .limit(20);

    console.log("\n=== Content Calendar ===\n");

    if (recentPosts?.length) {
      console.log("POSTED:");
      (recentPosts as any[]).forEach((p) => {
        const date = new Date(p.posted_at).toLocaleString();
        const title = (p.processed_articles?.title ?? "Unknown").slice(0, 50);
        console.log(`  ✔ ${date}  [${p.platform.toUpperCase().padEnd(10)}]  ${title}`);
      });
    }

    if (delayed.length) {
      console.log("\nSCHEDULED:");
      delayed.forEach((job) => {
        const runAt = new Date(Date.now() + (job.opts.delay ?? 0));
        console.log(`  ⏳ ${runAt.toLocaleString()}  [${job.data.platform.toUpperCase().padEnd(10)}]  ${job.name}`);
      });
    }

    if (waiting.length) {
      console.log("\nQUEUED (immediate):");
      waiting.forEach((job) => {
        console.log(`  ▶ [${job.data.platform.toUpperCase().padEnd(10)}]  ${job.name}`);
      });
    }

    if (!recentPosts?.length && !delayed.length && !waiting.length) {
      console.log("No content found.");
    }

    console.log("");
    await postQueue.close();
    process.exit(0);
  });

// ── flush-queue ────────────────────────────────────────────────────────────
program
  .command("flush-queue")
  .description("Clear all pending jobs from the social-posts queue")
  .action(async () => {
    const postQueue = new Queue("social-posts", { connection });
    await postQueue.obliterate({ force: true });
    console.log("Queue flushed.");
    await postQueue.close();
    process.exit(0);
  });

// ── test-telegram ──────────────────────────────────────────────────────────
program
  .command("test-telegram")
  .description("Send a test message to your configured Telegram chat")
  .action(async () => {
    const chatId = process.env.TELEGRAM_CHAT_ID!;
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Tech Content Pipeline test message. Bot is connected correctly.",
      }),
    });
    const data = await res.json() as any;
    console.log(data.ok ? "Telegram message sent successfully." : `Failed: ${data.description}`);
    process.exit(0);
  });

// ── failed-jobs ────────────────────────────────────────────────────────────
const failedCmd = program.command("failed-jobs").description("Manage failed posts");

failedCmd
  .command("list")
  .description("List all failed post jobs")
  .action(async () => {
    const { data } = await supabase
      .from("failed_posts")
      .select("id, platform, error, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data?.length) {
      console.log("No failed jobs.");
    } else {
      console.log("\nFailed Jobs:");
      (data as any[]).forEach((j) => {
        console.log(`  [${j.id.slice(0, 8)}]  ${j.platform.toUpperCase().padEnd(10)} ${new Date(j.created_at).toLocaleString()}  ${j.error}`);
      });
    }
    process.exit(0);
  });

failedCmd
  .command("retry <id>")
  .description("Retry a failed job by Supabase row ID")
  .action(async (id: string) => {
    const { data } = await supabase
      .from("failed_posts")
      .select("*")
      .eq("id", id)
      .single();

    if (!data) {
      console.error(`Job ${id} not found.`);
      process.exit(1);
    }

    const postQueue = new Queue("social-posts", { connection });
    await postQueue.add(`retry-${id}`, data.job_data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });

    console.log(`Job ${id} re-queued for ${data.platform}.`);
    await postQueue.close();
    process.exit(0);
  });

// ── reprocess ──────────────────────────────────────────────────────────────
program
  .command("reprocess <url>")
  .description("Re-run the pipeline for a specific article URL")
  .action(async (url: string) => {
    console.log(`Re-processing: ${url}`);

    const res = await fetch(url).catch(() => null);
    const html = res ? await res.text() : "";
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? url;

    const article = {
      id: url,
      url,
      title: title.slice(0, 200),
      description: "",
      content: html.slice(0, 5000),
      source: "manual",
      publishedAt: new Date().toISOString(),
      urlHash: createHash("md5").update(url).digest("hex"),
    };

    const pipeline = buildPipeline();
    await pipeline.invoke({ currentArticle: article });
    console.log("Done.");
    process.exit(0);
  });

program.parseAsync(process.argv);
