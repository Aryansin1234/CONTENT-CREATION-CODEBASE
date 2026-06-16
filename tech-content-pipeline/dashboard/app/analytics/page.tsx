import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function AnalyticsPage() {
  const { data: analytics } = await supabase
    .from("post_analytics")
    .select("platform, likes, comments, shares, reach")
    .order("fetched_at", { ascending: false })
    .limit(100);

  const { data: byType } = await supabase
    .from("post_results")
    .select("platform, processed_articles(content_type)")
    .order("posted_at", { ascending: false })
    .limit(200);

  const platforms = ["linkedin", "twitter", "instagram", "threads"];
  const platformStats = platforms.map((p) => {
    const rows = (analytics ?? []).filter((r: any) => r.platform === p);
    const totalReach = rows.reduce((s: number, r: any) => s + (r.reach || 0), 0);
    const totalEng = rows.reduce((s: number, r: any) => s + r.likes + r.comments + r.shares, 0);
    return {
      platform: p,
      posts: rows.length,
      totalReach,
      avgEngRate: totalReach > 0 ? ((totalEng / totalReach) * 100).toFixed(1) : "—",
    };
  });

  const typeMap: Record<string, number> = {};
  (byType ?? []).forEach((r: any) => {
    const ct = r.processed_articles?.content_type ?? "unknown";
    typeMap[ct] = (typeMap[ct] ?? 0) + 1;
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <a href="/" className="text-muted text-sm hover:text-indigo mb-6 inline-block">← Back</a>
      <h1 className="text-2xl font-bold text-white mb-8">Analytics</h1>

      <div className="grid grid-cols-2 gap-6 mb-10">
        {/* Platform breakdown */}
        <div className="bg-slate rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4">By Platform</h2>
          <div className="space-y-3">
            {platformStats.map((s) => (
              <div key={s.platform} className="flex justify-between text-sm">
                <span className="capitalize text-muted">{s.platform}</span>
                <span className="text-white">{s.posts} posts · {s.totalReach.toLocaleString()} reach · {s.avgEngRate}% eng</span>
              </div>
            ))}
          </div>
        </div>

        {/* Content type breakdown */}
        <div className="bg-slate rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4">By Content Type</h2>
          <div className="space-y-3">
            {Object.entries(typeMap).map(([type, count]) => (
              <div key={type} className="flex justify-between text-sm">
                <span className="capitalize text-muted">{type.replace("_", " ")}</span>
                <span className="text-white">{count} posts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
