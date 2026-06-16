"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReviewPageProps {
  params: { id: string };
}

export default function ReviewPage({ params }: ReviewPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"linkedin" | "instagram" | "twitter" | "threads">("linkedin");
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function approve(delay = 0) {
    setLoading(true);
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: params.id, action: "approve", captions, delay }),
    });
    router.push("/");
  }

  async function reject() {
    setLoading(true);
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: params.id, action: "reject" }),
    });
    router.push("/");
  }

  const tabs = ["linkedin", "instagram", "twitter", "threads"] as const;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <a href="/" className="text-muted text-sm hover:text-indigo mb-6 inline-block">← Back</a>
      <h1 className="text-2xl font-bold text-white mb-8">Review Content</h1>

      <div className="grid grid-cols-2 gap-8">
        {/* Left — image preview */}
        <div>
          <div className="bg-slate rounded-xl aspect-square flex items-center justify-center text-muted">
            Image preview loads here
          </div>
        </div>

        {/* Right — captions editor */}
        <div>
          {/* Tabs */}
          <div className="flex gap-1 mb-4">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  activeTab === tab
                    ? "bg-indigo text-white"
                    : "text-muted hover:text-white"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Editor */}
          <textarea
            className="w-full h-64 bg-slate rounded-xl p-4 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo"
            placeholder={`Edit ${activeTab} caption...`}
            value={captions[activeTab] ?? ""}
            onChange={(e) => setCaptions((prev) => ({ ...prev, [activeTab]: e.target.value }))}
          />

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => approve(0)}
              disabled={loading}
              className="flex-1 bg-indigo hover:bg-indigo-600 text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
            >
              Approve & Post Now
            </button>
            <button
              onClick={() => approve(2 * 60 * 60 * 1000)}
              disabled={loading}
              className="flex-1 bg-slate hover:bg-slate-600 text-white py-2.5 rounded-xl transition disabled:opacity-50"
            >
              +2h
            </button>
            <button
              onClick={reject}
              disabled={loading}
              className="bg-red-900 hover:bg-red-800 text-white px-4 py-2.5 rounded-xl transition disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
