import { auth, clerkClient } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { parseRepoUrl, classify, CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/changelog";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface Commit {
  sha: string;
  fullSha: string;
  title: string;
  body: string;
  date: string;
  author: string;
  emoji: string;
  files?: string;
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
      fullSha: c.sha,
      title,
      // cap descriptions at 500 chars to keep token usage reasonable
      body: body.length > 500 ? body.slice(0, 500) + "…" : body,
      date: c.commit.author.date.slice(0, 10),
      author: c.author?.login ?? c.commit.author.name ?? "unknown",
      emoji: classify(title),
    };
  });
}

async function fetchCommitFiles(
  owner: string,
  repo: string,
  sha: string,
  headers: Record<string, string>
): Promise<string> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
      { headers }
    );
    if (!res.ok) return "";
    const data = await res.json();
    if (!Array.isArray(data.files) || data.files.length === 0) return "";
    return data.files
      .slice(0, 8)
      .map((f: { filename: string; status: string; additions: number; deletions: number }) =>
        `${f.filename} (${f.status} +${f.additions}/-${f.deletions})`
      )
      .join(", ");
  } catch {
    return "";
  }
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function renderDayGroups(commits: Commit[], commitUrl: (sha: string) => string): string {
  const dayMap = new Map<string, Commit[]>();
  for (const c of commits) {
    if (!dayMap.has(c.date)) dayMap.set(c.date, []);
    dayMap.get(c.date)!.push(c);
  }

  return Array.from(dayMap.entries())
    .map(([dayKey, dayCommits]) => {
      const header = `### ${formatDayLabel(dayKey)}`;
      const entries = dayCommits
        .map(c => {
          const line = `${c.emoji} [${c.sha}](${commitUrl(c.sha)}) (@${c.author}) ${c.title}`;
          let entry = c.body ? `${line}\n  ${c.body.replace(/\n/g, "\n  ")}` : line;
          if (c.files) entry += `\n  Changed: ${c.files}`;
          return entry;
        })
        .join("\n");
      return `${header}\n\n${entries}`;
    })
    .join("\n\n");
}

function buildStructuredInput(commits: Commit[], tags: Tag[], commitUrl: (sha: string) => string): string {
  if (tags.length > 0) {
    const tagPositions = tags
      .map(t => ({ ...t, idx: commits.findIndex(c => c.sha === t.sha) }))
      .filter(t => t.idx !== -1)
      .sort((a, b) => a.idx - b.idx);

    if (tagPositions.length === 0) return buildStructuredInput(commits, [], commitUrl);

    const groups: { label: string; commits: Commit[] }[] = [];

    if (tagPositions[0].idx > 0) {
      groups.push({ label: "Unreleased", commits: commits.slice(0, tagPositions[0].idx) });
    }

    for (let i = 0; i < tagPositions.length; i++) {
      const start = tagPositions[i].idx;
      const end = tagPositions[i + 1]?.idx ?? commits.length;
      groups.push({ label: tagPositions[i].name, commits: commits.slice(start, end) });
    }

    return groups
      .filter(g => g.commits.length > 0)
      .map((g, i) => {
        const header = `## ${g.label}`;
        const body = renderDayGroups(g.commits, commitUrl);
        return i > 0 ? `---\n\n${header}\n\n${body}` : `${header}\n\n${body}`;
      })
      .join("\n\n");
  }

  // No tags — group by month then day
  const monthMap = new Map<string, Commit[]>();
  for (const c of commits) {
    const key = c.date.slice(0, 7);
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(c);
  }

  return Array.from(monthMap.entries())
    .map(([monthKey, monthCommits]) =>
      `## ${formatMonthLabel(monthKey)}\n\n${renderDayGroups(monthCommits, commitUrl)}`
    )
    .join("\n\n");
}

function buildPrompt(owner: string, repo: string, structuredInput: string): string {
  const categoryBlock = CATEGORY_ORDER
    .map(emoji => `   #### ${emoji} ${CATEGORY_LABELS[emoji]}`)
    .join("\n");

  return `You are a technical writer generating a CHANGELOG.md for "${owner}/${repo}".

The commit history below is already organized by date (and release tag where applicable). Your only job is to rewrite each commit into a clear, human-readable sentence and group them by category within each day section.

COMMIT DATA:
${structuredInput}

OUTPUT FORMAT RULES:
1. Preserve every ## and ### header exactly as given — do not add, remove, or rename them.
2. Within each ### day section, group commits under #### category headers in this exact order (omit categories with no entries):
${categoryBlock}
3. Each entry format: - Human-readable description ([sha](url)) (@username)
   - Copy the [sha](url) link and (@username) handle verbatim from the input.
   - Write the description from scratch — do not copy the raw commit message verbatim.
   - If a commit has an indented body beneath its title, use it to write a more specific description. Keep it to one concise sentence — enough detail to be useful, not a full paragraph.
   - If a "Changed:" line lists files, use the filenames to write a grounded description — they reveal what was actually modified even when the title is vague.
   - If the title is vague but files are present, infer what changed from the file paths (e.g. auth/session.ts → session handling, components/Button.tsx → UI button).
   - The emoji shown before each commit is a suggested category based on keywords. Override it if the commit title, body, or changed files clearly indicate a different category.
   - Exception: commits whose title begins with "Merge" or "Merged pull request" must always stay in ⚪ Maintenance — never reclassify them.
4. Output only the Markdown. No preamble, no explanation, no code fences.

EXAMPLE:
Input:
## v1.0.0

### April 15, 2026

🟢 [abc1234](https://github.com/x/y/commit/abc1234) (@laith) feat: add dark mode toggle
  Changed: components/ThemeToggle.tsx (added +45/-0), styles/globals.css (modified +12/-2)
⚪ [def5678](https://github.com/x/y/commit/def5678) (@laith) fix login
  Changed: auth/session.ts (modified +8/-40)

Output:
## v1.0.0

### April 15, 2026

#### 🟢 Features
- Added a dark mode toggle component with global stylesheet support ([abc1234](https://github.com/x/y/commit/abc1234)) (@laith)

#### 🔵 Bug Fixes
- Fixed a bug in session handling logic ([def5678](https://github.com/x/y/commit/def5678)) (@laith)`;
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

  const fileResults = await Promise.all(
    commits.map(c => fetchCommitFiles(owner, repo, c.fullSha, sharedHeaders))
  );
  commits = commits.map((c, i) => fileResults[i] ? { ...c, files: fileResults[i] } : c);

  const commitUrl = (sha: string) => `https://github.com/${owner}/${repo}/commit/${sha}`;
  const structuredInput = buildStructuredInput(commits, tags, commitUrl);
  const prompt = buildPrompt(owner, repo, structuredInput);

  // Try Gemini first, fall back to Groq on any failure
  try {
    const geminiModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { temperature: 0 },
    });
    const result = await geminiModel.generateContent(prompt);
    return NextResponse.json({ changelog: result.response.text(), model: "gemini" });
  } catch {
    // Gemini failed — attempt Groq fallback
  }

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      }),
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.json().catch(() => ({}));
      const message = (errBody as { error?: { message?: string } }).error?.message;
      throw new Error(message ?? `Groq API error: ${groqRes.status}`);
    }

    const groqData = await groqRes.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const changelog = groqData.choices[0]?.message?.content ?? "";
    return NextResponse.json({ changelog, model: "groq" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate changelog.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
