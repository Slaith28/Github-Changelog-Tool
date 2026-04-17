import { auth, clerkClient } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { parseRepoUrl, classify, formatCommitEntry } from "@/lib/changelog";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface Commit {
  sha: string;
  title: string;
  body: string;
  date: string;
  author: string;
  emoji: string;
}

interface Tag {
  name: string;
  sha: string;
}

async function fetchTags(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<Tag[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/tags?per_page=50`,
      { headers }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data)
      ? data.map((t: { name: string; commit: { sha: string } }) => ({
          name: t.name,
          sha: t.commit.sha.slice(0, 7),
        }))
      : [];
  } catch {
    return [];
  }
}

async function fetchCommits(
  owner: string,
  repo: string,
  githubToken: string | null,
  since?: string,
  until?: string
): Promise<Commit[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "github-changelog-tool",
  };
  const token = githubToken ?? process.env.GITHUB_TOKEN;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=50`;
  if (since) url += `&since=${since}`;
  if (until) url += `&until=${until}`;

  const res = await fetch(url, { headers });

  if (!res.ok) {
    if (res.status === 404) throw new Error("Repository not found or is private");
    if (res.status === 403) throw new Error("GitHub API rate limit exceeded");
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.map((c: {
    sha: string;
    commit: { message: string; author: { date: string; name: string } };
    author?: { login: string };
  }) => {
    const [title, ...rest] = c.commit.message.split("\n");
    const body = rest.join("\n").trim();

    return {
      sha: c.sha.slice(0, 7),
      title,
      // cap descriptions at 500 chars to keep token usage reasonable
      body: body.length > 500 ? body.slice(0, 500) + "…" : body,
      date: c.commit.author.date.slice(0, 10),
      author: c.author?.login ?? c.commit.author.name ?? "unknown",
      emoji: classify(title),
    };
  });
}

export async function POST(req: NextRequest) {
  const { userId } = auth();
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
  const since: string | undefined = body?.since;
  const until: string | undefined = body?.until;

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

  const { owner, repo } = parsed;

  const sharedHeaders: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "github-changelog-tool",
    ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
  };

  let tags: Tag[] = [];
  let commits: Commit[];
  try {
    [tags, commits] = await Promise.all([
      fetchTags(owner, repo, sharedHeaders),
      fetchCommits(owner, repo, githubToken, since, until),
    ]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch repository data" },
      { status: 400 }
    );
  }

  if (commits.length === 0) {
    return NextResponse.json(
      { error: "No commits found for the selected date range" },
      { status: 400 }
    );
  }

  const commitUrl = (sha: string) => `https://github.com/${owner}/${repo}/commit/${sha}`;

  const commitList = commits
    .map((c) => formatCommitEntry(c.emoji, c.sha, commitUrl(c.sha), c.date, c.author, c.title, c.body))
    .join("\n");

  const tagSection =
    tags.length > 0
      ? `Version tags (group commits into these releases):\n${tags.map((t) => `- ${t.name} → commit ${t.sha}`).join("\n")}\n\n`
      : "No version tags found — group commits by month instead.\n\n";

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  let result;
  try {
    result = await model.generateContent(
      `You are a technical writer generating a CHANGELOG.md for "${owner}/${repo}".

${tagSection}Commits (newest first):
${commitList}

Instructions:
- If version tags are provided, group commits under each release (## v1.2.0). Otherwise group by month (## March 2024).
- Within each group, sub-group by emoji: 🔴 Breaking Changes, 🟢 Features, 🔵 Bug Fixes, 📄 Documentation, ⚪ Maintenance — only include categories that have entries.
- Each entry format: "- Description ([sha](url)) (@username)" — preserve the commit links exactly as given.
- Write human-readable descriptions, don't copy commit messages verbatim.
- Output only the Markdown, no preamble or explanation.`
    );
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 503) {
      return NextResponse.json(
        { error: "The AI service is temporarily unavailable due to high demand. Please try again in a moment." },
        { status: 503 }
      );
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "AI quota exceeded. Please wait a moment and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate changelog. Please try again." },
      { status: 500 }
    );
  }

  const changelog = result.response.text();
  return NextResponse.json({ changelog });
}
