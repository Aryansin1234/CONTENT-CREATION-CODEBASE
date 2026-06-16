import "dotenv/config";
import cron from "node-cron";
import OpenAI from "openai";
import { supabase } from "../storage/supabase";
import { generateLearningPDF } from "../generators/pdfkit-generator";
import type { StructuredContent } from "../pipeline/state";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateWeeklyReport(): Promise<void> {
  console.log("[report-worker] Generating weekly performance report...");

  const since = new Date();
  since.setDate(since.getDate() - 7);

  // Aggregate metrics from last 7 days
  const { data: analytics } = await supabase
    .from("post_analytics")
    .select("platform, likes, comments, shares, reach, post_result_id")
    .gte("fetched_at", since.toISOString());

  if (!analytics?.length) {
    console.log("[report-worker] No analytics data yet — skipping report");
    return;
  }

  const totalPosts = analytics.length;
  const totalReach = analytics.reduce((s, r: any) => s + (r.reach || 0), 0);
  const totalEngagement = analytics.reduce((s, r: any) => s + r.likes + r.comments + r.shares, 0);
  const avgEngRate = totalReach > 0 ? ((totalEngagement / totalReach) * 100).toFixed(1) : "N/A";

  // Top post by engagement
  const top = analytics.sort((a: any, b: any) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares))[0] as any;

  // Content type breakdown
  const { data: typeBreakdown } = await supabase
    .from("post_results")
    .select("platform, article_id, processed_articles(content_type)")
    .gte("posted_at", since.toISOString());

  const typeCounts: Record<string, number> = {};
  (typeBreakdown ?? []).forEach((r: any) => {
    const ct = r.processed_articles?.content_type ?? "unknown";
    typeCounts[ct] = (typeCounts[ct] ?? 0) + 1;
  });

  const summaryData = {
    period: `${since.toDateString()} – ${new Date().toDateString()}`,
    totalPosts,
    totalReach,
    avgEngagementRate: `${avgEngRate}%`,
    topPostId: top?.post_result_id,
    contentTypeBreakdown: typeCounts,
  };

  // GPT-4o writes the narrative summary
  const summaryRes = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a social media analyst. Write a concise weekly performance summary (3-4 sentences) from the data. Include one actionable recommendation.",
      },
      { role: "user", content: JSON.stringify(summaryData, null, 2) },
    ],
  });

  const narrative = summaryRes.choices[0].message.content!;

  // Send Telegram message
  const chatId = process.env.TELEGRAM_CHAT_ID!;
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const message = `Weekly Report (${since.toDateString()} — ${new Date().toDateString()})\n\nPosts: ${totalPosts} | Reach: ${totalReach.toLocaleString()} | Avg Engagement: ${avgEngRate}%\n\n${narrative}`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });

  console.log("[report-worker] Weekly report sent to Telegram");
}

// Monday 9am
cron.schedule("0 9 * * 1", generateWeeklyReport);
console.log("[report-worker] Scheduled: Mondays at 9am");

if (process.argv.includes("--now")) generateWeeklyReport();
