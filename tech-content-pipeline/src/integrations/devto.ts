import Parser from "rss-parser";
import type { RawArticle } from "../pipeline/state";

export class DevToRSSClient {
  private parser = new Parser();

  async fetchLatest(opts: { limit: number; tag?: string }): Promise<RawArticle[]> {
    const tag = (opts.tag || "javascript,typescript,ai,devtools").split(",")[0];
    const feed = await this.parser.parseURL(`https://dev.to/feed/tag/${tag}`);

    return feed.items.slice(0, opts.limit).map((item) => ({
      id: item.link!,
      url: item.link!,
      title: item.title || "",
      description: item.contentSnippet || "",
      content: item.content || item.contentSnippet || "",
      source: "dev.to",
      publishedAt: item.pubDate || new Date().toISOString(),
      urlHash: "",
    }));
  }
}
