import { createHash } from "crypto";
import type { RawArticle } from "../state";
import { PipelineState } from "../state";
import { NewsAPIClient } from "../../integrations/newsapi";
import { GNewsClient } from "../../integrations/gnews";
import { DevToRSSClient } from "../../integrations/devto";
import { HackerNewsClient } from "../../integrations/hackernews";
import { ProductHuntClient } from "../../integrations/producthunt";
import { recordSourceResult } from "../../monitoring/source-health";

export async function ingestNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  console.log("[ingest] Fetching from 5 sources...");

  const results = await Promise.allSettled([
    new NewsAPIClient().fetchTechNews({ pageSize: 20 }),
    new GNewsClient().fetchTechNews({ max: 10 }),
    new DevToRSSClient().fetchLatest({ limit: 15 }),
    new HackerNewsClient().fetchTopStories({ limit: 20 }),
    new ProductHuntClient().fetchTodaysPosts({ limit: 10 }),
  ]);

  const sourceNames = ["NewsAPI", "GNews", "Dev.to", "Hacker News", "Product Hunt"];
  const rawArticles: RawArticle[] = [];

  results.forEach((result, i) => {
    const name = sourceNames[i];
    if (result.status === "fulfilled") {
      console.log(`[ingest] ${name}: ${result.value.length} articles`);
      rawArticles.push(...result.value);
      recordSourceResult(name, true).catch(console.error);
    } else {
      console.warn(`[ingest] ${name} failed:`, result.reason?.message);
      recordSourceResult(name, false).catch(console.error);
    }
  });

  const withHashes = rawArticles.map((article) => ({
    ...article,
    urlHash: createHash("md5").update(article.url).digest("hex"),
  }));

  console.log(`[ingest] Total raw: ${withHashes.length}`);
  return { rawArticles: withHashes };
}
