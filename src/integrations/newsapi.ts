import type { RawArticle } from "../pipeline/state";

export class NewsAPIClient {
  private baseUrl = "https://newsapi.org/v2";

  async fetchTechNews(opts: { pageSize: number; from?: string }): Promise<RawArticle[]> {
    const params = new URLSearchParams({
      q: "artificial intelligence OR LLM OR developer tools OR open source",
      language: "en",
      sortBy: "publishedAt",
      pageSize: String(opts.pageSize),
      from: opts.from || new Date(Date.now() - 86400000).toISOString(),
      apiKey: process.env.NEWSAPI_KEY!,
    });

    const res = await fetch(`${this.baseUrl}/everything?${params}`);
    if (!res.ok) throw new Error(`NewsAPI error: ${res.status}`);
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
      source: `NewsAPI:${article.source?.name || "unknown"}`,
      publishedAt: article.publishedAt || new Date().toISOString(),
      urlHash: "",
    };
  }
}
