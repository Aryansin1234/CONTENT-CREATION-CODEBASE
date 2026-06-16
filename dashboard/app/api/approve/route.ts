import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
  const body = await request.json();
  const { id, action, captions, delay = 0 } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  if (action === "reject") {
    await supabase
      .from("pending_reviews")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    // Fetch the pending review
    const { data: review } = await supabase
      .from("pending_reviews")
      .select("*")
      .eq("id", id)
      .single();

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Update status
    await supabase
      .from("pending_reviews")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        schedule_delay: delay,
        captions: captions ?? review.captions,
      })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
