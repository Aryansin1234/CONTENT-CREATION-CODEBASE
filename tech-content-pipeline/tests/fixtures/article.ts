import type { RawArticle } from "../src/pipeline/state";

export const seedArticle: RawArticle = {
  id: "https://example.com/test-article",
  url: "https://example.com/test-article",
  title: "OpenAI releases GPT-5 with 10x reasoning improvements",
  description: "The latest model from OpenAI significantly outperforms previous versions on benchmarks.",
  content: "OpenAI has announced GPT-5, a new large language model that achieves state-of-the-art results on multiple reasoning and coding benchmarks. The model shows 10x improvement on the AIME mathematics benchmark and achieves 99% on the MMLU test. Developers can access GPT-5 via the API immediately. Pricing is set at $15 per million input tokens.",
  source: "NewsAPI:TechCrunch",
  publishedAt: new Date().toISOString(),
  urlHash: "abc123def456",
};
