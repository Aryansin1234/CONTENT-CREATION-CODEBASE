import type { PostResult } from "../pipeline/state";

export class ThreadsPoster {
  private baseUrl = "https://graph.facebook.com/v19.0";
  private igUserId = process.env.INSTAGRAM_USER_ID!;
  private accessToken = process.env.INSTAGRAM_ACCESS_TOKEN!;

  async post(text: string): Promise<PostResult> {
    // Step 1: Create Threads media container
    const containerRes = await fetch(`${this.baseUrl}/${this.igUserId}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "TEXT",
        text,
        access_token: this.accessToken,
      }),
    });

    if (!containerRes.ok) {
      const err = await containerRes.text();
      throw new Error(`Threads container creation failed: ${containerRes.status} ${err}`);
    }

    const { id: containerId } = await containerRes.json() as { id: string };

    // Step 2: Publish
    const publishRes = await fetch(`${this.baseUrl}/${this.igUserId}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerId, access_token: this.accessToken }),
    });

    if (!publishRes.ok) throw new Error(`Threads publish failed: ${publishRes.status}`);
    const { id: postId } = await publishRes.json() as { id: string };

    return {
      platform: "threads" as any,
      postId,
      url: `https://www.threads.net/post/${postId}`,
      postedAt: new Date().toISOString(),
    };
  }
}
