import { Queue } from "bullmq";
import { PipelineState } from "../state";
import { supabase } from "../../storage/supabase";
import { isNearRateLimit } from "../../monitoring/source-health";

const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || "6379", 10),
};
const postQueue = new Queue("social-posts", { connection });

export async function postContentNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  const { captions, imageUrl, pdfUrl, carouselUrl, platformFit, approvalStatus, currentArticle, scheduleDelay } = state;

  if (approvalStatus !== "approved" || !captions) return {};

  // Idempotency: skip platforms already posted for this article
  const eligiblePlatforms = await filterAlreadyPosted(platformFit, currentArticle?.urlHash);
  if (eligiblePlatforms.length === 0) {
    console.log("[postContent] All platforms already posted — skipping");
    return {};
  }

  console.log(`[postContent] Queuing jobs for: ${eligiblePlatforms.join(", ")}${scheduleDelay ? ` (delayed ${Math.round(scheduleDelay / 60000)}min)` : ""}`);

  const jobs = await Promise.all(
    eligiblePlatforms.map(async (platform) => {
      const nearLimit = await isNearRateLimit(platform).catch(() => false);
      // Use human-set schedule delay, or rate-limit delay, whichever is larger
      const baseDelay = scheduleDelay ?? 0;
      const rateLimitDelay = nearLimit ? 15 * 60 * 1000 : 0;
      return {
        name: `post-${platform}-${Date.now()}`,
        data: {
          platform,
          caption: platform === "twitter" ? captions.twitterThread : captions[platform as "linkedin" | "instagram"],
          imageUrl: platform === "linkedin" && carouselUrl ? carouselUrl : (imageUrl ?? undefined),
          pdfUrl: platform === "linkedin" ? (pdfUrl ?? undefined) : undefined,
          urlHash: currentArticle?.urlHash,
        },
        opts: {
          attempts: 3,
          backoff: { type: "exponential" as const, delay: 5000 },
          delay: Math.max(baseDelay, rateLimitDelay),
        },
      };
    })
  );

  await postQueue.addBulk(jobs);
  console.log(`[postContent] ${jobs.length} job(s) added to queue`);

  return {};
}

async function filterAlreadyPosted(platforms: string[], urlHash?: string | null): Promise<string[]> {
  if (!urlHash) return platforms;

  const { data: article } = await supabase
    .from("processed_articles")
    .select("id")
    .eq("url_hash", urlHash)
    .single();

  if (!article) return platforms;

  const { data: existing } = await supabase
    .from("post_results")
    .select("platform")
    .eq("article_id", article.id);

  const posted = new Set((existing ?? []).map((r: { platform: string }) => r.platform));
  return platforms.filter((p) => !posted.has(p));
}
