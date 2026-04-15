import { auth, clerkClient } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

interface Commit {
  sha: string;
  message: string;
  date: string;
}

async function fetchCommits(
  owner: string,
  repo: string,
  githubToken: string | null
): Promise<Commit[]> {
  const commits: Commit[] = [];
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "github-changelog-tool",
  };

  // use the user's OAuth token if available, otherwise fall back to the env var
  const token = githubToken ?? process.env.GITHUB_TOKEN;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // paginate up to 500 commits (5 pages of 100)
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100&page=${page}`,
      { headers }
    );

    if (!res.ok) {
      if (res.status === 404) throw new Error("Repository not found or is private");
      if (res.status === 403) throw new Error("GitHub API rate limit exceeded");
      throw new Error(`GitHub API error: ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const c of data) {
      const fullMessage = c.commit.message as string;
      const [title, ...rest] = fullMessage.split("\n");
      const description = rest.join("\n").trim();

      // cap descriptions at 300 chars so huge PR bodies don't eat up the token budget
      const truncatedDescription =
        description.length > 300 ? description.slice(0, 300) + "…" : description;

      commits.push({
        sha: (c.sha as string).slice(0, 7),
        message: truncatedDescription
          ? `${title}\n  ${truncatedDescription.replace(/\n/g, "\n  ")}`
          : title,
        date: (c.commit.author.date as string).slice(0, 10),
      });
    }

    if (data.length < 100) break;
  }

  return commits;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // pull the user's GitHub OAuth token from Clerk so private repos are accessible
  let githubToken: string | null = null;
  try {
    const client = clerkClient();
    const response = await client.users.getUserOauthAccessToken(userId, "oauth_github");
    const tokenData = response as { data?: Array<{ token: string }> } | Array<{ token: string }>;
    githubToken =
      (Array.isArray(tokenData) ? tokenData[0]?.token : tokenData.data?.[0]?.token) ?? null;
  } catch {
    // not fatal — unauthenticated requests still work for public repos
  }

  const body = await req.json();
  const repoUrl: string = body?.repoUrl ?? "";

  if (!repoUrl) {
    return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
  }

  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid GitHub URL — expected https://github.com/owner/repo" },
      { status: 400 }
    );
  }

  let commits: Commit[];
  try {
    commits = await fetchCommits(parsed.owner, parsed.repo, githubToken);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch commits" },
      { status: 400 }
    );
  }

  if (commits.length === 0) {
    return NextResponse.json({ error: "No commits found in this repository" }, { status: 400 });
  }

  const commitList = commits
    .map((c) => `[${c.sha}] ${c.date} ${c.message}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a technical writer. Given the following git commits from "${parsed.owner}/${parsed.repo}", produce a clean CHANGELOG.md in Markdown format.

Rules:
- Group commits into categories: Features, Bug Fixes, Documentation, Refactoring, Tests, Chores — use only categories that have entries.
- Write human-readable descriptions; don't copy commit messages verbatim.
- List most recent changes first.
- Output only the Markdown, no preamble or explanation.

Commits (newest first):
${commitList}`,
      },
    ],
  });

  const changelog =
    response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ changelog });
}
