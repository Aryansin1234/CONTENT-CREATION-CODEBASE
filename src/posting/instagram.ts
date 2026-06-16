import type { PostResult } from "../pipeline/state";

export class InstagramPoster {
  private baseUrl = "https://graph.facebook.com/v19.0";
  private igUserId = process.env.INSTAGRAM_USER_ID!;
  private accessToken = process.env.INSTAGRAM_ACCESS_TOKEN!;

  async post(caption: string, imageUrl: string): Promise<PostResult> {
    // Step 1: Create media container
    const containerRes = await fetch(`${this.baseUrl}/${this.igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: this.accessToken,
      }),
    });

    if (!containerRes.ok) throw new Error(`Instagram container creation failed: ${containerRes.status}`);
    const { id: containerId } = await containerRes.json() as { id: string };

    // Step 2: Wait for media to finish processing
    await this.waitForContainer(containerId);

    // Step 3: Publish
    const publishRes = await fetch(`${this.baseUrl}/${this.igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerId, access_token: this.accessToken }),
    });

    if (!publishRes.ok) throw new Error(`Instagram publish failed: ${publishRes.status}`);
    const { id: postId } = await publishRes.json() as { id: string };

    return {
      platform: "instagram",
      postId,
      url: `https://www.instagram.com/p/${postId}`,
      postedAt: new Date().toISOString(),
    };
  }

  private async waitForContainer(containerId: string, maxAttempts = 10): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(
        `${this.baseUrl}/${containerId}?fields=status_code&access_token=${this.accessToken}`
      );
      const { status_code } = await res.json() as { status_code: string };
      if (status_code === "FINISHED") return;
      if (status_code === "ERROR") throw new Error("Instagram media container errored");
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error("Instagram media container timed out");
  }
}
