"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Repo {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  description: string | null;
  updated_at: string;
}

interface RepoListProps {
  repos: Repo[];
  loading: boolean;
  generating: boolean;
  activeRepo: string;
  onGenerate: (repoUrl: string) => void;
}

export default function RepoList({ repos, loading, generating, activeRepo, onGenerate }: RepoListProps) {
  const [search, setSearch] = useState("");

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No repositories found. Make sure you signed in with the right GitHub account.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search repositories..."
      />

      <ScrollArea className="h-96 pr-3">
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No repositories match your search.</p>
          ) : (
            filtered.map((repo) => {
              const repoUrl = `https://github.com/${repo.full_name}`;
              const isActive = activeRepo === repoUrl && generating;

              return (
                <div
                  key={repo.id}
                  className="flex items-center justify-between border border-border rounded-lg px-4 py-3 gap-4 bg-card"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate text-card-foreground">
                        {repo.full_name}
                      </span>
                      <Badge variant={repo.private ? "outline" : "secondary"} className="text-xs shrink-0">
                        {repo.private ? "private" : "public"}
                      </Badge>
                    </div>
                    {repo.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {repo.description}
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    onClick={() => onGenerate(repoUrl)}
                    disabled={generating}
                    className="shrink-0"
                  >
                    {isActive ? "Generating…" : "Generate"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
