"use client";

import { useState, useEffect } from "react";
import { useUser, SignOutButton } from "@clerk/nextjs";
import Image from "next/image";
import RepoList from "@/components/RepoList";
import DateRangeFilter from "@/components/DateRangeFilter";
import ChangelogDisplay from "@/components/ChangelogDisplay";
import AboutBox from "@/components/AboutBox";

interface Repo {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  description: string | null;
  updated_at: string;
}

interface DateRange {
  since?: string;
  until?: string;
}

export default function Dashboard() {
  const { user } = useUser();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [changelog, setChangelog] = useState("");
  const [generating, setGenerating] = useState(false);
  const [activeRepo, setActiveRepo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/repos")
      .then((r) => r.json())
      .then((data) => setRepos(data.repos ?? []))
      .catch(() => {})
      .finally(() => setReposLoading(false));
  }, []);

  const generateChangelog = async (repoUrl: string) => {
    setGenerating(true);
    setError("");
    setChangelog("");
    setActiveRepo(repoUrl);

    try {
      const res = await fetch("/api/generate-changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, ...dateRange }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate changelog");
      setChangelog(data.changelog);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const githubAccount = user?.externalAccounts?.find((a) => a.provider === "github");
  const githubUsername = githubAccount?.username ?? user?.username;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">GitHub Changelog Tool</h1>

        {user && (
          <div className="flex items-center gap-3">
            {user.imageUrl && (
              <Image
                src={user.imageUrl}
                alt={githubUsername ?? "profile"}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            {githubUsername && (
              <span className="text-sm text-gray-300">{githubUsername}</span>
            )}
            <SignOutButton redirectUrl="/">
              <button className="text-sm text-gray-400 hover:text-white transition-colors">
                Sign out
              </button>
            </SignOutButton>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        <AboutBox />

        {/* date range filter */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wide">
              Filter by Date Range
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Only commits within this range will be included in the generated changelog.
            </p>
          </div>
          <DateRangeFilter onChange={setDateRange} />
          <p className="text-xs text-gray-600">
            ⚠️ Limited to 50 commits per request with descriptions capped at 500 characters — free tier API limits.
          </p>
        </section>

        {/* user's repos */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Your Repositories</h2>
          <RepoList
            repos={repos}
            loading={reposLoading}
            generating={generating}
            activeRepo={activeRepo}
            onGenerate={generateChangelog}
          />
        </section>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {changelog && (
          <ChangelogDisplay changelog={changelog} repoUrl={activeRepo} />
        )}
      </main>
    </div>
  );
}
