import "dotenv/config";
import cron from "node-cron";
import OpenAI from "openai";
import { supabase } from "../storage/supabase";
import { loadPrompt } from "../utils/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function runSynthesis(): Promise<void> {
  console.log("[synthesis-worker] Generating cross-article synthesis post...");

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data: articles } = await supabase
    .from("processed_articles")
    .select("id, title, content_type")
    .gte("created_at", since.toISOString())
    .limit(30);

  if (!articles || articles.length < 3) {
    console.log("[synthesis-worker] Not enough articles for synthesis — skipping");
    return;
  }

  const titles = articles.map((a: any) => a.title);

  // Embed all titles
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: titles,
  });

  // Cluster by cosine similarity > 0.8
  const clusters: number[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < embRes.data.length; i++) {
    if (assigned.has(i)) continue;
    const cluster = [i];
    for (let j = i + 1; j < embRes.data.length; j++) {
      if (assigned.has(j)) continue;
      const sim = cosineSim(embRes.data[i].embedding, embRes.data[j].embedding);
      if (sim > 0.8) { cluster.push(j); assigned.add(j); }
    }
    clusters.push(cluster);
    assigned.add(i);
  }

  // Pick largest cluster
  const topCluster = clusters.sort((a, b) => b.length - a.length)[0];
  if (topCluster.length < 3) {
    console.log("[synthesis-worker] No cluster large enough — skipping");
    return;
  }

  const clusterTitles = topCluster.map((i) => titles[i]);
  console.log(`[synthesis-worker] Top cluster has ${clusterTitles.length} articles`);

  // Generate synthesis LinkedIn post
  const toneProfile = loadPrompt("tone-profile.txt");
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a tech thought leader. Write a LinkedIn synthesis post that connects insights across multiple articles on the same topic.
Format: "I read ${clusterTitles.length} articles about [topic] this week. Here's what they all missed:"
- One key insight per article (bullet points)
- One original contrarian observation at the end
- 800-1000 characters total
- End with a question
${toneProfile.includes("[PASTE YOUR POSTS HERE]") ? "" : `Voice: ${toneProfile.slice(0, 500)}`}`,
      },
      { role: "user", content: `Articles:\n${clusterTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}` },
    ],
  });

  const post = response.choices[0].message.content!;

  // Send to Telegram for approval
  const chatId = process.env.TELEGRAM_CHAT_ID!;
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `Synthesis Post Ready (${clusterTitles.length} articles clustered)\n\n${post}\n\nReply 'approve' to queue for LinkedIn, or 'skip' to discard.`,
    }),
  });

  console.log("[synthesis-worker] Synthesis post sent to Telegram for approval");
}

function cosineSim(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (magA * magB);
}

// Friday 10am
cron.schedule("0 10 * * 5", runSynthesis);
console.log("[synthesis-worker] Scheduled: Fridays at 10am");

if (process.argv.includes("--now")) runSynthesis();
