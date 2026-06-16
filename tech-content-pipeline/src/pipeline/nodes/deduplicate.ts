import OpenAI from "openai";
import { supabase } from "../../storage/supabase";
import { PipelineState } from "../state";
import type { RawArticle } from "../state";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function deduplicateNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  const { rawArticles } = state;
  if (rawArticles.length === 0) return { dedupedArticles: [] };

  console.log(`[dedup] Starting with ${rawArticles.length} articles`);

  // Step 1: Exact URL hash dedup against already-processed articles
  const hashes = rawArticles.map((a) => a.urlHash);
  const { data: existing } = await supabase
    .from("processed_articles")
    .select("url_hash")
    .in("url_hash", hashes);

  const seenHashes = new Set((existing || []).map((r: any) => r.url_hash));
  const urlDeduped = rawArticles.filter((a) => !seenHashes.has(a.urlHash));
  console.log(`[dedup] After URL hash filter: ${urlDeduped.length} (removed ${rawArticles.length - urlDeduped.length} already-processed)`);

  if (urlDeduped.length === 0) return { dedupedArticles: [] };

  // Step 2: Semantic dedup via embeddings — catches rephrased duplicates from different sources
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: urlDeduped.map((a) => `${a.title} ${a.description}`.slice(0, 500)),
  });

  const embeddings = embeddingResponse.data.map((e) => e.embedding);
  const uniqueArticles = filterBySimilarity(urlDeduped, embeddings, 0.92);
  console.log(`[dedup] After semantic filter: ${uniqueArticles.length} (removed ${urlDeduped.length - uniqueArticles.length} near-duplicates)`);

  // Apply MAX_ARTICLES_PER_RUN cap
  const maxArticles = parseInt(process.env.MAX_ARTICLES_PER_RUN || "5", 10);
  const capped = uniqueArticles.slice(0, maxArticles);
  console.log(`[dedup] Capped to ${capped.length} articles for this run`);

  return { dedupedArticles: capped };
}

function filterBySimilarity(
  articles: RawArticle[],
  embeddings: number[][],
  threshold: number
): RawArticle[] {
  const kept: number[] = [];

  for (let i = 0; i < articles.length; i++) {
    const isDuplicate = kept.some((j) => cosineSimilarity(embeddings[i], embeddings[j]) > threshold);
    if (!isDuplicate) kept.push(i);
  }

  return kept.map((i) => articles[i]);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}
