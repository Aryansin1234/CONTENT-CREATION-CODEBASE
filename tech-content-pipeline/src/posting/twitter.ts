import { TwitterApi } from "twitter-api-v2";
import type { PostResult } from "../pipeline/state";

export class TwitterPoster {
  private client: TwitterApi;

  constructor() {
    this.client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    });
  }

  async postThread(tweets: string[], imageUrl?: string): Promise<PostResult> {
    let previousTweetId: string | undefined;
    let firstTweetId: string | undefined;

    for (let i = 0; i < tweets.length; i++) {
      const params: Record<string, unknown> = { text: tweets[i] };

      // Attach image to the first tweet only
      if (i === 0 && imageUrl) {
        const mediaId = await this.uploadMedia(imageUrl);
        params.media = { media_ids: [mediaId] };
      }

      // Chain into thread
      if (previousTweetId) {
        params.reply = { in_reply_to_tweet_id: previousTweetId };
      }

      const { data } = await this.client.v2.tweet(params as any);
      if (i === 0) firstTweetId = data.id;
      previousTweetId = data.id;

      // Brief delay to preserve thread order
      if (i < tweets.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    return {
      platform: "twitter",
      postId: firstTweetId!,
      url: `https://twitter.com/i/web/status/${firstTweetId}`,
      postedAt: new Date().toISOString(),
    };
  }

  private async uploadMedia(imageUrl: string): Promise<string> {
    const arrayBuffer = await fetch(imageUrl).then((r) => r.arrayBuffer());
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));
    return this.client.v1.uploadMedia(buffer, { mimeType: "image/png" });
  }
}
