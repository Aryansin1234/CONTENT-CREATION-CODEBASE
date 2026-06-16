import type { RawArticle } from "../pipeline/state";

interface HNItem {
  id: number;
  url?: string;
  title?: string;
  text?: string;
  score?: number;
  time?: number;
}

export class HackerNewsClient {
  private baseUrl = "https://hacker-news.firebaseio.com/v0";

  async fetchTopStories(opts: { limit: number }): Promise<RawArticle[]> {
    const storyIds = await fetch(`${this.baseUrl}/topstories.json`).then((r) => r.json()) as number[];

    const stories = await Promise.all(
      storyIds.slice(0, opts.limit * 3).map((id) =>
        fetch(`${this.baseUrl}/item/${id}.json`).then((r) => r.json()) as Promise<HNItem>
      )
    );

    return stories
      .filter((s): s is HNItem & Required<Pick<HNItem, "url">> => Boolean(s?.url && (s.score ?? 0) > 100))
      .slice(0, opts.limit)
      .map((s) => ({
        id: String(s.id),
        url: s.url,
        title: s.title || "",
        description: s.title || "",
        content: s.text || s.title || "",
        source: "Hacker News",
        publishedAt: new Date((s.time ?? 0) * 1000).toISOString(),
        urlHash: "",
      }));
  }
}
