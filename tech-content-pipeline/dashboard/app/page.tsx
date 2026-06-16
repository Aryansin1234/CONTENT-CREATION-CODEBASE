import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { data: pending } = await supabase
    .from("pending_reviews")
    .select("id, article, captions, image_url, created_at, status")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: stats } = await supabase
    .from("post_results")
    .select("platform")
    .gte("posted_at", new Date(Date.now() - 7 * 86400000).toISOString());

  const platformCounts = (stats ?? []).reduce((acc: Record<string, number>, r: any) => {
    acc[r.platform] = (acc[r.platform] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white">Content Pipeline</h1>
          <p className="text-muted mt-1">Review and approve AI-generated social content</p>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href="/analytics" className="text-muted hover:text-indigo transition">Analytics</Link>
          <Link href="/calendar" className="text-muted hover:text-indigo transition">Calendar</Link>
        </nav>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {["linkedin", "twitter", "instagram", "threads"].map((p) => (
          <div key={p} className="bg-slate rounded-xl p-4">
            <p className="text-muted text-xs uppercase tracking-widest mb-1">{p}</p>
            <p className="text-2xl font-bold text-white">{platformCounts[p] ?? 0}</p>
            <p className="text-muted text-xs">posts this week</p>
          </div>
        ))}
      </div>

      {/* Pending reviews */}
      <h2 className="text-lg font-semibold text-white mb-4">
        Pending Review
        <span className="ml-2 text-sm text-muted font-normal">({(pending ?? []).length})</span>
      </h2>

      {!(pending ?? []).length && (
        <div className="bg-slate rounded-xl p-8 text-center text-muted">
          No pending articles. Pipeline will populate this when it runs.
        </div>
      )}

      <div className="space-y-4">
        {(pending ?? []).map((item: any) => (
          <Link key={item.id} href={`/review/${item.id}`}>
            <div className="bg-slate rounded-xl p-5 hover:border hover:border-indigo cursor-pointer transition">
              <div className="flex items-start justify-between">
                <div className="flex-1 mr-4">
                  <h3 className="font-semibold text-white leading-snug">
                    {item.article?.title ?? "Untitled"}
                  </h3>
                  <p className="text-muted text-sm mt-1">
                    {item.article?.source} · {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt=""
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <span className="text-xs bg-dark text-indigo-light px-2 py-1 rounded">LinkedIn</span>
                <span className="text-xs bg-dark text-indigo-light px-2 py-1 rounded">Twitter</span>
                {item.captions?.threads && (
                  <span className="text-xs bg-dark text-indigo-light px-2 py-1 rounded">Threads</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
