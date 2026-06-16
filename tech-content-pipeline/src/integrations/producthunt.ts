import type { RawArticle } from "../pipeline/state";

export class ProductHuntClient {
  private endpoint = "https://api.producthunt.com/v2/api/graphql";

  async fetchTodaysPosts(opts: { limit: number }): Promise<RawArticle[]> {
    const query = `
      query {
        posts(first: ${opts.limit}, order: VOTES) {
          edges {
            node {
              id
              name
              tagline
              description
              url
              votesCount
              topics {
                edges {
                  node { name }
                }
              }
            }
          }
        }
      }
    `;

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PRODUCTHUNT_TOKEN}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) throw new Error(`Product Hunt error: ${res.status}`);
    const { data } = await res.json() as { data: any };

    return data.posts.edges.map(({ node }: any) => ({
      id: node.id,
      url: node.url,
      title: node.name,
      description: node.tagline || "",
      content: node.description || node.tagline || "",
      source: "Product Hunt",
      publishedAt: new Date().toISOString(),
      urlHash: "",
    }));
  }
}
