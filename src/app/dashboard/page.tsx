"use client";

import { useState, useEffect, useRef } from "react";
import { useUser, SignOutButton } from "@clerk/nextjs";
import Image from "next/image";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import RepoList from "@/components/RepoList";
import DateRangeFilter from "@/components/DateRangeFilter";
import ChangelogDisplay from "@/components/ChangelogDisplay";
import { Progress } from "@/components/ui/progress";

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
  const [changelogModel, setChangelogModel] = useState<"gemini" | "groq" | undefined>();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeRepo, setActiveRepo] = useState("");
  const [error, setError] = useState("");
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

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
    setChangelogModel(undefined);
    setActiveRepo(repoUrl);

    // Simulate progress: asymptotically approach 90%, then jump to 100% on completion
    setProgress(0);
    progressInterval.current = setInterval(() => {
      setProgress((p) => p + (90 - p) * 0.06);
    }, 200);

    try {
      const res = await fetch("/api/generate-changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, ...dateRange }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate changelog");
      setChangelog(data.changelog);
      setChangelogModel(data.model);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      if (progressInterval.current) clearInterval(progressInterval.current);
      setProgress(100);
      setTimeout(() => {
        setGenerating(false);
        setProgress(0);
      }, 400);
    }
  };

  const githubAccount = user?.externalAccounts?.find((a) => a.provider === "github");
  const githubUsername = githubAccount?.username ?? user?.username;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <GitBranch className="w-5 h-5" />
          <span className="font-semibold text-foreground">GitHub Changelog Tool</span>
        </div>

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
              <span className="text-sm text-muted-foreground">{githubUsername}</span>
            )}
            <SignOutButton redirectUrl="/">
              <Button variant="ghost" size="sm">
                Sign out
              </Button>
            </SignOutButton>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        {/* About */}
        <Card>
          <CardContent className="pt-6 space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p className="text-foreground">
              Generate a structured changelog from the commit history of any of your
              repositories. Commits are grouped by release version (if tags exist) or
              by date, categorized by type, and each entry includes the commit author
              and a direct link to the diff.
            </p>
            <Separator />
            <div className="space-y-1 text-xs">
              <p>⚠️ Org repos may not appear without third-party OAuth access from your org.</p>
              <p>⚠️ Currently limited to commits on the default branch (main/master).</p>
              <p>⚠️ This tool runs on free-tier AI API keys. Please be mindful of how often you generate — if you encounter errors, it is likely due to rate limits or quota being exhausted.</p>
            </div>
          </CardContent>
        </Card>

        {/* Date Range Filter */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium uppercase tracking-wide">
              Filter by Date Range
            </CardTitle>
            <CardDescription>
              Only commits within this range will be included in the generated changelog.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DateRangeFilter onChange={setDateRange} />
          </CardContent>
        </Card>

        {/* Repository List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Your Repositories</CardTitle>
            <CardDescription>
              Select a repository to generate its changelog.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RepoList
              repos={repos}
              loading={reposLoading}
              generating={generating}
              activeRepo={activeRepo}
              onGenerate={generateChangelog}
            />
          </CardContent>
        </Card>

        {/* Progress bar */}
        {generating && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Generating changelog…</p>
            <Progress value={progress} />
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {/* Changelog Output */}
        {changelog && (
          <ChangelogDisplay changelog={changelog} repoUrl={activeRepo} model={changelogModel} />
        )}
      </main>

      <p className="fixed bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/50">
        Developed by Laith Shakir (@Slaith28)
      </p>
    </div>
  );
}
