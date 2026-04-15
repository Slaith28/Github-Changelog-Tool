"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import RepoForm from "@/components/RepoForm";
import ChangelogDisplay from "@/components/ChangelogDisplay";

export default function Dashboard() {
  const [changelog, setChangelog] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleGenerate = async (repoUrl: string) => {
    setLoading(true);
    setError("");
    setChangelog("");

    try {
      const res = await fetch("/api/generate-changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate changelog");
      setChangelog(data.changelog);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">GitHub Changelog Tool</h1>
        <UserButton afterSignOutUrl="/" />
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <RepoForm onSubmit={handleGenerate} loading={loading} />

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {changelog && <ChangelogDisplay changelog={changelog} />}
      </main>
    </div>
  );
}
