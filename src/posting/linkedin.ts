import type { PostResult } from "../pipeline/state";

export class LinkedInPoster {
  private baseUrl = "https://api.linkedin.com/v2";
  private accessToken = process.env.LINKEDIN_ACCESS_TOKEN!;
  private personId = process.env.LINKEDIN_PERSON_ID!;

  async post(caption: string, imageUrl?: string): Promise<PostResult> {
    let mediaAsset: string | undefined;

    if (imageUrl) {
      mediaAsset = await this.uploadImage(imageUrl);
    }

    const body: Record<string, unknown> = {
      author: `urn:li:person:${this.personId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: caption },
          shareMediaCategory: mediaAsset ? "IMAGE" : "NONE",
          ...(mediaAsset && {
            media: [{ status: "READY", media: mediaAsset }],
          }),
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    const res = await fetch(`${this.baseUrl}/ugcPosts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LinkedIn post failed: ${res.status} ${err}`);
    }

    const data = await res.json() as { id: string };
    return {
      platform: "linkedin",
      postId: data.id,
      url: `https://www.linkedin.com/feed/update/${data.id}`,
      postedAt: new Date().toISOString(),
    };
  }

  private async uploadImage(imageUrl: string): Promise<string> {
    // Step 1: Register upload
    const registerRes = await fetch(`${this.baseUrl}/assets?action=registerUpload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: `urn:li:person:${this.personId}`,
          serviceRelationships: [{
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          }],
        },
      }),
    });

    const { value } = await registerRes.json() as any;
    const uploadUrl = value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
    const asset = value.asset;

    // Step 2: Upload binary
    const imageBuffer = await fetch(imageUrl).then((r) => r.arrayBuffer());
    await fetch(uploadUrl, { method: "PUT", body: imageBuffer });

    return asset;
  }
}
