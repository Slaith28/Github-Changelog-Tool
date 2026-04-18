# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered changelog generator from GitHub commits. Users sign in with GitHub OAuth, browse their own repos, and generate a structured changelog from any repo's commit history. Output is rendered in-app and exportable as `.md`, `.txt`, or `.json`.

- GitHub remote: https://github.com/Slaith28/Github-Changelog-Tool
- Stack: Next.js 14 (App Router) · TypeScript · Tailwind CSS · Clerk v5 · Google Gemini 2.5 Flash (primary) · Llama 3.3 70B via Groq (fallback) · react-markdown

## Commands

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
npm test         # Jest unit tests (51 tests, ~0.5s)
```

## Environment Variables

Copy `.env.example` → `.env.local` and fill in:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard |
| `CLERK_SECRET_KEY` | Clerk dashboard |
| `GEMINI_API_KEY` | aistudio.google.com/app/apikey |
| `GROQ_API_KEY` | console.groq.com |
| `GITHUB_TOKEN` | Optional — raises GitHub rate limit 60 → 5000 req/hr |

Clerk OAuth must have `repo` scope enabled (Clerk dashboard → GitHub social connection → scopes). Users need to sign out and back in after adding it.

## Architecture

```
src/
  middleware.ts                         # protects /dashboard and /api/*
  css.d.ts                              # declares *.css module type (suppresses TS2882)
  lib/
    changelog.ts                        # pure functions: parseRepoUrl, classify, toPlainText,
                                        # formatCommitEntry, CATEGORY_ORDER, CATEGORY_LABELS
  app/
    layout.tsx                          # ClerkProvider wrapper
    page.tsx                            # landing page — auto-redirects signed-in users to /dashboard
    sign-in/[[...sign-in]]/page.tsx
    sign-up/[[...sign-up]]/page.tsx
    dashboard/page.tsx                  # main UI (client component)
    api/
      repos/route.ts                    # GET — fetches user's GitHub repos via OAuth token
      generate-changelog/route.ts       # POST — commits + tags → pre-grouped input → Gemini/Groq → changelog markdown
  components/
    DateRangeFilter.tsx                 # preset + custom date range picker
    RepoList.tsx                        # searchable repo list with per-repo Generate buttons
    ChangelogDisplay.tsx                # renders markdown via react-markdown; copy + export buttons; shows which model generated
    ui/
      progress.tsx                      # shadcn-style Progress bar (Tailwind only, no radix-progress dep)
  __tests__/
    changelog.test.ts                   # Jest unit tests for all pure functions
```

## Data Flow

1. On load, dashboard fetches `/api/repos` — returns all repos the user's GitHub token has access to.
2. User optionally sets a date range (`since`/`until` passed to GitHub API).
3. User clicks Generate → progress bar animates while POST `/api/generate-changelog` runs with `{ repoUrl, since?, until? }`.
4. Route handler: fetches tags + up to 50 commits in parallel, classifies each commit, then **pre-groups commits in code** by tag → month → day. Commit body is included in the prompt so the AI can write detailed descriptions.
5. Gemini 2.5 Flash is called first. On any failure (503, 429, or other), the handler falls back to Groq (Llama 3.3 70B) with the same prompt.
6. Response includes `{ changelog, model }` — `model` is `"gemini"` or `"groq"`.
7. `ChangelogDisplay` renders the markdown and shows which model generated it.

## Changelog Output Format

Commits are pre-grouped in the route handler before being sent to the AI. The AI only writes human-readable descriptions — all structure is enforced in code.

**With release tags:**
```
## v2.1.0
### April 15, 2026
#### 🟢 Features
- Description ([sha](url)) (@username)
#### 🔵 Bug Fixes
- Description ([sha](url)) (@username)
---
## v2.0.0
...
```

**Without tags (grouped by month → day):**
```
## April 2026
### April 15, 2026
#### 🟢 Features
- Description ([sha](url)) (@username)
```

## Commit Categories

Defined in `src/lib/changelog.ts` — `classify()` assigns an emoji, `CATEGORY_ORDER` sets display order, `CATEGORY_LABELS` maps emoji → name.

| Emoji | Name | Trigger keywords |
|---|---|---|
| 🔴 | Breaking Changes | "breaking change", "removed", "deprecate" |
| 🟢 | Features | `feat:`, `add `, `implement `, `new `, `feature:` |
| 🔵 | Bug Fixes | `fix:`, `bug:`, `resolve `, `patch `, `hotfix ` |
| 🔒 | Security | `security`, `vuln`, `cve`, `xss`, `csrf` anywhere |
| ⚡ | Performance | `perf:`, `optim:`, `performance:` |
| 📄 | Documentation | `docs:`, `doc:`, `readme `, `documentation:` |
| ⚪ | Maintenance | everything else |

## Key Notes

- Max 50 commits per request, commit bodies capped at 500 chars.
- AI fallback: Gemini → Groq. Both receive the identical pre-grouped prompt, producing consistent output structure regardless of which model runs.
- `toPlainText` strips markdown for `.txt` export; `formatCommitEntry` is used in tests (the route builds its own entry strings directly).
- Clerk v5 uses `auth()` synchronously in route handlers and `clerkClient()` as a function (not singleton).
- `src/components/ui/progress.tsx` is a custom shadcn-style component — `@radix-ui/react-progress` is NOT installed.
