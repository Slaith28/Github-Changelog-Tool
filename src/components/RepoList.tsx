"use client";

import { useState } from "react";

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
          <div key={i} className="h-16 bg-gray-900 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <p className="text-gray-500 text-sm">No repositories found. Make sure you signed in with the right GitHub account.</p>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search repositories..."
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm">No repositories match your search.</p>
        ) : (
          filtered.map((repo) => {
            const repoUrl = `https://github.com/${repo.full_name}`;
            const isActive = activeRepo === repoUrl && generating;

            return (
              <div
                key={repo.id}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{repo.full_name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${repo.private ? "bg-yellow-900/50 text-yellow-400" : "bg-gray-800 text-gray-400"}`}>
                      {repo.private ? "private" : "public"}
                    </span>
                  </div>
                  {repo.description && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{repo.description}</p>
                  )}
                </div>

                <button
                  onClick={() => onGenerate(repoUrl)}
                  disabled={generating}
                  className="shrink-0 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
                >
                  {isActive ? "Generating…" : "Generate"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
