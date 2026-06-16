import { supabase } from "../storage/supabase";

const ALERT_THRESHOLD = 3;

// Source names must match what ingest.ts logs
export const SOURCE_NAMES = ["NewsAPI", "GNews", "Dev.to", "Hacker News", "Product Hunt"] as const;
export type SourceName = (typeof SOURCE_NAMES)[number];

export async function recordSourceResult(source: string, success: boolean): Promise<void> {
  if (success) {
    await supabase.from("source_health").upsert(
      {
        source_name: source,
        consecutive_fails: 0,
        last_success_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_name" }
    );
    return;
  }

  // Increment failure count
  const { data } = await supabase
    .from("source_health")
    .select("consecutive_fails")
    .eq("source_name", source)
    .single();

  const newCount = (data?.consecutive_fails ?? 0) + 1;

  await supabase.from("source_health").upsert(
    {
      source_name: source,
      consecutive_fails: newCount,
      last_fail_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source_name" }
  );

  if (newCount >= ALERT_THRESHOLD) {
    await sendSourceAlert(source, newCount);
  }
}

async function sendSourceAlert(source: string, failCount: number): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID!;
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const message = `Source alert: ${source} has failed ${failCount} consecutive times. Check your API key or the service status.`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  }).catch(console.error);
}

export async function recordRejectionReason(
  urlHash: string,
  reasonCode: number
): Promise<void> {
  const reasonMap: Record<number, string> = {
    1: "Off-brand",
    2: "Low quality",
    3: "Already covered",
    4: "Too promotional",
  };
  await supabase.from("rejection_reasons").insert({
    url_hash: urlHash,
    reason_code: reasonCode,
    reason_text: reasonMap[reasonCode] ?? "Unknown",
  });
}

// Daily post counter — used by postContent.ts for rate-limit pre-flight
const DAILY_LIMITS: Record<string, number> = {
  linkedin: 100,
  twitter: 300,
  instagram: 25,
  threads: 25,
};

export async function isNearRateLimit(platform: string): Promise<boolean> {
  const limit = DAILY_LIMITS[platform];
  if (!limit) return false;

  const { data } = await supabase
    .from("platform_rate_limits")
    .select("posts_today, window_start")
    .eq("platform", platform)
    .single();

  if (!data) return false;

  // Reset window if it's a new day
  const windowStart = new Date(data.window_start);
  const now = new Date();
  if (now.getTime() - windowStart.getTime() > 24 * 60 * 60 * 1000) return false;

  // Alert at 85% of limit
  return data.posts_today >= Math.floor(limit * 0.85);
}

export async function incrementPostCount(platform: string): Promise<void> {
  const { data } = await supabase
    .from("platform_rate_limits")
    .select("posts_today, window_start")
    .eq("platform", platform)
    .single();

  const now = new Date().toISOString();

  if (!data || new Date().getTime() - new Date(data.window_start).getTime() > 24 * 60 * 60 * 1000) {
    await supabase.from("platform_rate_limits").upsert(
      { platform, posts_today: 1, window_start: now, updated_at: now },
      { onConflict: "platform" }
    );
  } else {
    await supabase
      .from("platform_rate_limits")
      .update({ posts_today: data.posts_today + 1, updated_at: now })
      .eq("platform", platform);
  }
}
