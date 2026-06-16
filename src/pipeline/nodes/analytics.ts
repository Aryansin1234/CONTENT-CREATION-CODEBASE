import { PipelineState } from "../state";
import { supabase } from "../../storage/supabase";

export async function analyticsNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  const { currentArticle, contentType, postResults } = state;

  // Record article as processed (prevents it from being re-ingested)
  if (currentArticle) {
    await supabase.from("processed_articles").upsert({
      url_hash: currentArticle.urlHash,
      title: currentArticle.title,
      source: currentArticle.source,
      published_at: currentArticle.publishedAt,
      content_type: contentType,
    }, { onConflict: "url_hash" });
  }

  // Store posting results
  if (postResults.length > 0 && currentArticle) {
    const { data: article } = await supabase
      .from("processed_articles")
      .select("id")
      .eq("url_hash", currentArticle.urlHash)
      .single();

    if (article) {
      await supabase.from("post_results").insert(
        postResults.map((r) => ({
          article_id: article.id,
          platform: r.platform,
          post_id: r.postId,
          url: r.url,
          posted_at: r.postedAt,
        }))
      );
    }
  }

  console.log(`[analytics] Recorded ${postResults.length} post result(s) to Supabase`);
  return {};
}
