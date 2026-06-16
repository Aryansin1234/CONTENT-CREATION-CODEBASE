import "dotenv/config";
import cron from "node-cron";
import Parser from "rss-parser";
import OpenAI from "openai";
import { supabase } from "../storage/supabase";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const parser = new Parser();

interface Competitor {
  name: string;
  rssUrl: string;
}

function loadCompetitors(): Competitor[] {
  const path = join(process.cwd(), "competitors.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8"));
}

async function runCompetitorAnalysis(): Promise<void> {
  const competitors = loadCompetitors();
  if (!competitors.length) {
    console.log("[competitor-worker] No competitors.json found — skipping");
    return;
  }

  console.log(`[competitor-worker] Analysing ${competitors.length} competitors...`);

  const allArticles: Array<{ competitor: string; title: string; url: string }> = [];

  for (const comp of competitors) {
    try {
      const feed = await parser.parseURL(comp.rssUrl);
      const items = feed.items.slice(0, 20).map((item) => ({
        competitor: comp.name,
        title: item.title ?? "",
        url: item.link ?? "",
      }));
      allArticles.push(...items);
    } catch (err) {
      console.warn(`[competitor-worker] Failed to fetch ${comp.name}:`, (err as Error).message);
    }
  }

  if (!allArticles.length) return;

  // Embed all titles
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: allArticles.map((a) => a.title),
  });

  // Fetch our own recent article embeddings for comparison
  const { data: ourArticles } = await supabase
    .from("processed_articles")
    .select("title")
    .order("created_at", { ascending: false })
    .limit(50);

  const ourTitles = (ourArticles ?? []).map((a: any) => a.title);
  const ourEmbRes = ourTitles.length
    ? await openai.embeddings.create({ model: "text-embedding-3-small", input: ourTitles })
    : null;

  // Find competitor topics we haven't covered (low similarity to any of our articles)
  const uncovered: string[] = [];
  embRes.data.forEach((emb, i) => {
    const compVec = emb.embedding;
    const maxSimilarity = ourEmbRes
      ? Math.max(...ourEmbRes.data.map((o) => cosineSim(compVec, o.embedding)))
      : 0;
    if (maxSimilarity < 0.75) {
      uncovered.push(`${allArticles[i].competitor}: ${allArticles[i].title}`);
    }
  });

  if (uncovered.length === 0) {
    console.log("[competitor-worker] No uncovered topics found");
    return;
  }

  const chatId = process.env.TELEGRAM_CHAT_ID!;
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const topUncovered = uncovered.slice(0, 5).join("\n• ");
  const message = `Competitor gaps found (${uncovered.length} topics you haven't covered):\n\n• ${topUncovered}`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });

  console.log(`[competitor-worker] Reported ${uncovered.length} uncovered topics`);
}

function cosineSim(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (magA * magB);
}

// Weekly on Wednesday at 9am
cron.schedule("0 9 * * 3", runCompetitorAnalysis);
console.log("[competitor-worker] Scheduled: Wednesdays at 9am");

if (process.argv.includes("--now")) runCompetitorAnalysis();
