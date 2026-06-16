import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage() {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data: posts } = await supabase
    .from("post_results")
    .select("platform, posted_at, processed_articles(title)")
    .gte("posted_at", since.toISOString())
    .order("posted_at", { ascending: true });

  // Group by day
  const grouped: Record<string, any[]> = {};
  (posts ?? []).forEach((p: any) => {
    const d = new Date(p.posted_at).toDateString();
    grouped[d] = [...(grouped[d] ?? []), p];
  });

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <a href="/" className="text-muted text-sm hover:text-indigo mb-6 inline-block">← Back</a>
      <h1 className="text-2xl font-bold text-white mb-8">Content Calendar (last 7 days)</h1>

      <div className="grid grid-cols-7 gap-3">
        {last7.map((day) => {
          const key = day.toDateString();
          const dayPosts = grouped[key] ?? [];
          const isToday = key === new Date().toDateString();
          return (
            <div
              key={key}
              className={`bg-slate rounded-xl p-3 min-h-36 ${isToday ? "ring-2 ring-indigo" : ""}`}
            >
              <p className="text-xs font-bold text-indigo mb-1">{DAYS[day.getDay()]}</p>
              <p className="text-xs text-muted mb-3">{day.getDate()}</p>
              {dayPosts.length === 0 && (
                <p className="text-xs text-muted opacity-40">—</p>
              )}
              {dayPosts.map((p: any, i: number) => (
                <div key={i} className="text-xs bg-dark rounded p-1.5 mb-1.5 leading-tight">
                  <span className="text-indigo-light font-semibold capitalize">{p.platform}</span>
                  <p className="text-muted mt-0.5 truncate">{p.processed_articles?.title?.slice(0, 30)}</p>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
