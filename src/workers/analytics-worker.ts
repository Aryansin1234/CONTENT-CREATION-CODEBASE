import "dotenv/config";
import cron from "node-cron";
import OpenAI from "openai";
import { supabase } from "../storage/supabase";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface Metrics {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  clicks: number;
}

async function fetchAndStoreAnalytics(): Promise<void> {
  console.log("[analytics-worker] Fetching engagement metrics...");

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: posts } = await supabase
    .from("post_results")
    .select("id, platform, post_id, url")
    .gte("posted_at", since.toISOString());

  if (!posts?.length) {
    console.log("[analytics-worker] No posts to fetch metrics for");
    return;
  }

  // Fetch metrics per platform
  const analyticsRows: object[] = [];

  for (const post of posts) {
    let metrics: { likes: number; comments: number; shares: number; reach: number; clicks: number } = {
      likes: 0, comments: 0, shares: 0, reach: 0, clicks: 0,
    };

    try {
      if (post.platform === "linkedin") {
        metrics = await fetchLinkedInMetrics(post.post_id);
      } else if (post.platform === "twitter") {
        metrics = await fetchTwitterMetrics(post.post_id);
      }
      // Instagram metrics require a separate endpoint — add when needed
    } catch {
      // Non-fatal: metrics fetch failure shouldn't stop the job
    }

    analyticsRows.push({ post_result_id: post.id, platform: post.platform, ...metrics });
  }

  if (analyticsRows.length > 0) {
    await supabase.from("post_analytics").insert(analyticsRows);
    console.log(`[analytics-worker] Stored metrics for ${analyticsRows.length} posts`);
  }
}

async function fetchLinkedInMetrics(postId: string): Promise<Metrics> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN!;
  const res = await fetch(
    `https://api.linkedin.com/v2/socialActions/${postId}`,
    { headers: { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0" } }
  );
  if (!res.ok) return { likes: 0, comments: 0, shares: 0, reach: 0, clicks: 0 };
  const data = await res.json() as any;
  return {
    likes: data.likesSummary?.totalLikes ?? 0,
    comments: data.commentsSummary?.totalFirstLevelComments ?? 0,
    shares: data.sharesSummary?.totalShares ?? 0,
    reach: 0,
    clicks: 0,
  };
}

async function fetchTwitterMetrics(tweetId: string): Promise<Metrics> {
  const token = process.env.TWITTER_ACCESS_TOKEN!;
  const res = await fetch(
    `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return { likes: 0, comments: 0, shares: 0, reach: 0, clicks: 0 };
  const data = await res.json() as any;
  const m = data.data?.public_metrics ?? {};
  return {
    likes: m.like_count ?? 0,
    comments: m.reply_count ?? 0,
    shares: m.retweet_count ?? 0,
    reach: m.impression_count ?? 0,
    clicks: m.url_link_clicks ?? 0,
  };
}

// Monday 9am — fetch metrics + inject top performers into caption context
cron.schedule("0 9 * * 1", fetchAndStoreAnalytics);
console.log("[analytics-worker] Scheduled: Mondays at 9am");

if (process.argv.includes("--now")) fetchAndStoreAnalytics();
