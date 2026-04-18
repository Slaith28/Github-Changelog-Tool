export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

export function classify(title: string): string {
  if (/breaking.change|BREAKING CHANGE|\bremov(e[sd]?|ing)\b|\bdeprecat/i.test(title)) return "🔴";
  if (/^(feat|add|implement|new|feature)(\(|:|!|\s)/i.test(title)) return "🟢";
  if (/^(fix|bug|resolve|patch|hotfix)(\(|:|!|\s)/i.test(title)) return "🔵";
  if (/\b(security|vuln(erability)?|cve|xss|csrf)\b/i.test(title)) return "🔒";
  if (/^(perf|optim|performance)(\(|:|!|\s)/i.test(title)) return "⚡";
  if (/^(docs?|documentation|readme)(\(|:|!|\s)/i.test(title)) return "📄";
  return "⚪";
}

export const CATEGORY_ORDER = ["🔴", "🟢", "🔵", "🔒", "⚡", "📄", "⚪"] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  "🔴": "Breaking Changes",
  "🟢": "Features",
  "🔵": "Bug Fixes",
  "🔒": "Security",
  "⚡": "Performance",
  "📄": "Documentation",
  "⚪": "Maintenance",
};

// strip markdown syntax for plain text export
export function toPlainText(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*]\s+/gm, "• ")
    .trim();
}

export function formatCommitEntry(
  emoji: string,
  sha: string,
  commitUrl: string,
  date: string,
  author: string,
  title: string,
  body: string
): string {
  const link = `[${sha}](${commitUrl})`;
  const line = `${emoji} ${link} ${date} (@${author}) ${title}`;
  return body ? `${line}\n  ${body.replace(/\n/g, "\n  ")}` : line;
}
