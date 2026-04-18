import { parseRepoUrl, classify, toPlainText, formatCommitEntry } from "@/lib/changelog";

// ---------------------------------------------------------------------------
// parseRepoUrl
// ---------------------------------------------------------------------------

describe("parseRepoUrl", () => {
  it("parses a standard GitHub URL", () => {
    expect(parseRepoUrl("https://github.com/laith/my-project")).toEqual({
      owner: "laith",
      repo: "my-project",
    });
  });

  it("strips trailing slashes", () => {
    expect(parseRepoUrl("https://github.com/laith/my-project/")).toEqual({
      owner: "laith",
      repo: "my-project",
    });
  });

  it("ignores subdirectory paths and only takes the first two segments", () => {
    expect(parseRepoUrl("https://github.com/laith/my-project/tree/main")).toEqual({
      owner: "laith",
      repo: "my-project",
    });
  });

  it("returns null for non-GitHub URLs", () => {
    expect(parseRepoUrl("https://gitlab.com/laith/my-project")).toBeNull();
  });

  it("returns null for a GitHub URL with no repo segment", () => {
    expect(parseRepoUrl("https://github.com/laith")).toBeNull();
  });

  it("returns null for completely invalid input", () => {
    expect(parseRepoUrl("not a url at all")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseRepoUrl("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// classify — emoji severity detection
// ---------------------------------------------------------------------------

describe("classify", () => {
  // 🟢 Features
  it("detects conventional 'feat:' prefix as feature", () => {
    expect(classify("feat: add dark mode toggle")).toBe("🟢");
  });

  it("detects 'feat(scope):' as feature", () => {
    expect(classify("feat(auth): add OAuth2 login flow")).toBe("🟢");
  });

  it("detects 'add ' prefix as feature", () => {
    expect(classify("add user profile page")).toBe("🟢");
  });

  it("detects 'implement ' as feature", () => {
    expect(classify("implement rate limiting on API endpoints")).toBe("🟢");
  });

  it("detects 'new ' prefix as feature", () => {
    expect(classify("new dashboard layout with sidebar navigation")).toBe("🟢");
  });

  // 🔵 Bug fixes
  it("detects 'fix:' as bug fix", () => {
    expect(classify("fix: resolve null pointer in user service")).toBe("🔵");
  });

  it("detects 'fix(scope):' as bug fix", () => {
    expect(classify("fix(ui): button not responding on mobile")).toBe("🔵");
  });

  it("detects 'patch ' as bug fix", () => {
    expect(classify("patch incorrect date formatting in reports")).toBe("🔵");
  });

  it("detects 'hotfix ' as bug fix", () => {
    expect(classify("hotfix critical auth bypass vulnerability")).toBe("🔵");
  });

  it("detects 'resolve ' as bug fix", () => {
    expect(classify("resolve race condition in async job queue")).toBe("🔵");
  });

  // 🔴 Breaking changes
  it("detects 'BREAKING CHANGE' anywhere in the title", () => {
    expect(classify("refactor: BREAKING CHANGE remove v1 API endpoints")).toBe("🔴");
  });

  it("detects 'breaking change' (lowercase)", () => {
    expect(classify("breaking change: drop support for Node 14")).toBe("🔴");
  });

  it("detects 'removed' as breaking", () => {
    expect(classify("removed legacy authentication middleware")).toBe("🔴");
  });

  it("detects 'deprecate' as breaking", () => {
    expect(classify("deprecate the /v1/users endpoint")).toBe("🔴");
  });

  // 📄 Documentation
  it("detects 'docs:' as documentation", () => {
    expect(classify("docs: update API reference for auth module")).toBe("📄");
  });

  it("detects 'readme ' as documentation", () => {
    expect(classify("readme add installation instructions")).toBe("📄");
  });

  it("detects 'documentation ' as documentation", () => {
    expect(classify("documentation improve onboarding guide")).toBe("📄");
  });

  // 🔒 Security
  it("detects 'security:' as security", () => {
    expect(classify("security: patch XSS vulnerability in markdown renderer")).toBe("🔒");
  });

  it("detects 'vuln' keyword as security", () => {
    expect(classify("vuln in auth token parsing")).toBe("🔒");
  });

  it("detects 'cve' keyword as security", () => {
    expect(classify("CVE-2025-1234 in dependency")).toBe("🔒");
  });

  it("detects 'xss' keyword as security", () => {
    expect(classify("prevent XSS in user input fields")).toBe("🔒");
  });

  // ⚡ Performance
  it("detects 'perf:' as performance", () => {
    expect(classify("perf: reduce database query count on dashboard load")).toBe("⚡");
  });

  it("detects 'perf(scope):' as performance", () => {
    expect(classify("perf(api): cache expensive user lookups")).toBe("⚡");
  });

  it("detects 'optim ' as performance", () => {
    expect(classify("optim: reduce bundle size by 30%")).toBe("⚡");
  });

  // ⚪ Maintenance / chores
  it("classifies 'chore:' as maintenance", () => {
    expect(classify("chore: bump dependency versions")).toBe("⚪");
  });

  it("classifies 'refactor:' as maintenance", () => {
    expect(classify("refactor: extract auth helpers into separate module")).toBe("⚪");
  });

  it("classifies 'test:' as maintenance", () => {
    expect(classify("test: add unit tests for user service")).toBe("⚪");
  });

  it("classifies 'ci:' as maintenance", () => {
    expect(classify("ci: add GitHub Actions workflow for staging deploy")).toBe("⚪");
  });

  it("classifies a plain message with no prefix as maintenance", () => {
    expect(classify("update project configuration")).toBe("⚪");
  });

  it("classifies 'style:' as maintenance", () => {
    expect(classify("style: format files with prettier")).toBe("⚪");
  });
});

// ---------------------------------------------------------------------------
// toPlainText — markdown stripping
// ---------------------------------------------------------------------------

describe("toPlainText", () => {
  it("strips h1 and h2 headers", () => {
    const md = "# Changelog\n## v1.0.0";
    expect(toPlainText(md)).toBe("Changelog\nv1.0.0");
  });

  it("strips bold markers", () => {
    expect(toPlainText("**Breaking Changes**")).toBe("Breaking Changes");
  });

  it("strips italic markers", () => {
    expect(toPlainText("*important fix*")).toBe("important fix");
  });

  it("converts markdown links to plain text (discards URL)", () => {
    expect(toPlainText("[abc1234](https://github.com/owner/repo/commit/abc1234)")).toBe("abc1234");
  });

  it("converts list dashes to bullet points", () => {
    expect(toPlainText("- Added feature A\n- Fixed bug B")).toBe("• Added feature A\n• Fixed bug B");
  });

  it("handles a realistic changelog snippet", () => {
    const md = [
      "## v2.0.0",
      "",
      "### 🟢 Features",
      "- Add dark mode ([abc1234](https://github.com/x/y/commit/abc1234)) (@laith)",
      "",
      "### 🔵 Bug Fixes",
      "- Fix login redirect ([def5678](https://github.com/x/y/commit/def5678)) (@bob)",
    ].join("\n");

    const plain = toPlainText(md);
    expect(plain).toContain("v2.0.0");
    expect(plain).toContain("Add dark mode");
    expect(plain).toContain("Fix login redirect");
    expect(plain).not.toContain("https://");
    expect(plain).not.toContain("##");
    expect(plain).not.toContain("###");
  });
});

// ---------------------------------------------------------------------------
// formatCommitEntry — prompt formatting
// ---------------------------------------------------------------------------

describe("formatCommitEntry", () => {
  const url = "https://github.com/laith/project/commit/abc1234";

  it("formats a commit with no body as a single line", () => {
    const result = formatCommitEntry("🟢", "abc1234", url, "2024-03-01", "laith", "feat: add login", "");
    expect(result).toBe("🟢 [abc1234](https://github.com/laith/project/commit/abc1234) 2024-03-01 (@laith) feat: add login");
  });

  it("includes indented body when present", () => {
    const result = formatCommitEntry("🔵", "def5678", url, "2024-02-15", "bob", "fix: null crash", "Happened when user object was undefined on logout.");
    expect(result).toContain("fix: null crash");
    expect(result).toContain("Happened when user object");
  });

  it("indents multi-line bodies correctly", () => {
    const result = formatCommitEntry("⚪", "aaa0000", url, "2024-01-10", "alice", "chore: cleanup", "Line one\nLine two\nLine three");
    const lines = result.split("\n");
    expect(lines[0]).toMatch(/^⚪/);
    expect(lines[1]).toMatch(/^\s{2}/); // indented
    expect(lines[2]).toMatch(/^\s{2}/);
  });

  it("includes the author handle", () => {
    const result = formatCommitEntry("🔴", "bbb1111", url, "2024-01-05", "carol", "removed deprecated API", "");
    expect(result).toContain("(@carol)");
  });

  it("includes the emoji", () => {
    const result = formatCommitEntry("📄", "ccc2222", url, "2024-01-03", "dave", "docs: update README", "");
    expect(result).toMatch(/^📄/);
  });
});

// ---------------------------------------------------------------------------
// Realistic fake repo scenario — end-to-end logic check
// ---------------------------------------------------------------------------

describe("full commit pipeline (fake repo data)", () => {
  const fakeCommits = [
    { title: "feat: add multi-factor authentication",         author: "laith",  date: "2024-04-10" },
    { title: "fix(auth): resolve token expiry not refreshing", author: "sara",   date: "2024-04-08" },
    { title: "docs: add MFA setup guide to README",           author: "laith",  date: "2024-04-07" },
    { title: "BREAKING CHANGE: remove v1 login endpoint",     author: "admin",  date: "2024-04-05" },
    { title: "chore: upgrade jest to v30",                    author: "bot",    date: "2024-04-03" },
    { title: "refactor: split auth service into modules",     author: "sara",   date: "2024-04-01" },
    { title: "feat(dashboard): implement repo search filter", author: "laith",  date: "2024-03-28" },
    { title: "hotfix crash on empty commit list",             author: "laith",  date: "2024-03-25" },
    { title: "test: add integration tests for changelog API", author: "sara",   date: "2024-03-20" },
    { title: "deprecate legacy export format",                author: "admin",  date: "2024-03-15" },
    { title: "new settings page with theme selector",         author: "laith",  date: "2024-03-10" },
    { title: "ci: add automated deploy to staging",           author: "bot",    date: "2024-03-05" },
  ];

  it("classifies all fake commits into the right emoji buckets", () => {
    const classified = fakeCommits.map((c) => ({ ...c, emoji: classify(c.title) }));

    const features  = classified.filter((c) => c.emoji === "🟢");
    const fixes     = classified.filter((c) => c.emoji === "🔵");
    const breaking  = classified.filter((c) => c.emoji === "🔴");
    const docs      = classified.filter((c) => c.emoji === "📄");
    const chores    = classified.filter((c) => c.emoji === "⚪");

    expect(features.length).toBe(3);  // feat MFA, feat dashboard, new settings
    expect(fixes.length).toBe(2);     // fix token expiry, hotfix crash
    expect(breaking.length).toBe(2);  // BREAKING CHANGE remove endpoint, deprecate
    expect(docs.length).toBe(1);      // docs README
    expect(chores.length).toBe(4);    // chore, refactor, test, ci
  });

  it("formats all commits as valid prompt lines with links", () => {
    const owner = "laith";
    const repo  = "fake-project";

    const lines = fakeCommits.map((c, i) => {
      const sha = `abc${String(i).padStart(4, "0")}`;
      const url = `https://github.com/${owner}/${repo}/commit/${sha}`;
      return formatCommitEntry(classify(c.title), sha, url, c.date, c.author, c.title, "");
    });

    lines.forEach((line) => {
      expect(line).toMatch(/https:\/\/github\.com\/laith\/fake-project\/commit\//);
      expect(line).toMatch(/@\w+/); // has @author
      expect(line).toMatch(/\d{4}-\d{2}-\d{2}/); // has date
    });
  });

  it("produces unique commit lines for each fake commit", () => {
    const lines = fakeCommits.map((c, i) =>
      formatCommitEntry(classify(c.title), `sha${i}`, `https://github.com/x/y/commit/sha${i}`, c.date, c.author, c.title, "")
    );
    const unique = new Set(lines);
    expect(unique.size).toBe(fakeCommits.length);
  });
});
