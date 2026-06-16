import type { RawArticle } from "../pipeline/state";

export class GNewsClient {
  private baseUrl = "https://gnews.io/api/v4";

  async fetchTechNews(opts: { max: number }): Promise<RawArticle[]> {
    const params = new URLSearchParams({
      q: "artificial intelligence OR programming OR developer",
      lang: "en",
      topic: "technology",
      max: String(opts.max),
      apikey: process.env.GNEWS_API_KEY!,
    });

    const res = await fetch(`${this.baseUrl}/search?${params}`);
    if (!res.ok) throw new Error(`GNews error: ${res.status}`);
    const data = await res.json() as { articles: any[] };
    return (data.articles || []).map(this.normalize);
  }

  private normalize(article: any): RawArticle {
    return {
      id: article.url,
      url: article.url,
      title: article.title || "",
      description: article.description || "",
      content: article.content || article.description || "",
      source: `GNews:${article.source?.name || "unknown"}`,
      publishedAt: article.publishedAt || new Date().toISOString(),
      urlHash: "",
    };
  }
}
