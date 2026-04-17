# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered changelog generator from GitHub commits. Users sign in with GitHub OAuth, browse their own repos, and generate a structured changelog from any repo's commit history. Output is rendered in-app and exportable as `.md`, `.txt`, or `.json`.

- GitHub remote: https://github.com/Slaith28/Github-Changelog-Tool
- Stack: Next.js 14 (App Router) · TypeScript · Tailwind CSS · Clerk v5 · Google Gemini 2.5 Flash · react-markdown

## Commands

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
npm test         # Jest unit tests (44 tests, ~0.5s)
```

## Environment Variables

Copy `.env.example` → `.env.local` and fill in:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard |
| `CLERK_SECRET_KEY` | Clerk dashboard |
| `GEMINI_API_KEY` | aistudio.google.com/app/apikey |
| `GITHUB_TOKEN` | Optional — raises GitHub rate limit 60 → 5000 req/hr |

Clerk OAuth must have `repo` scope enabled (Clerk dashboard → GitHub social connection → scopes). Users need to sign out and back in after adding it.

## Architecture

```
src/
  middleware.ts                         # protects /dashboard and /api/*
  lib/
    changelog.ts                        # shared pure functions: parseRepoUrl, classify, toPlainText, formatCommitEntry
  app/
    layout.tsx                          # ClerkProvider wrapper
    page.tsx                            # landing page — auto-redirects signed-in users to /dashboard
    sign-in/[[...sign-in]]/page.tsx
    sign-up/[[...sign-up]]/page.tsx
    dashboard/page.tsx                  # main UI (client component)
    api/
      repos/route.ts                    # GET — fetches user's GitHub repos via OAuth token
      generate-changelog/route.ts       # POST — GitHub commits + tags → Gemini → changelog markdown
  components/
    AboutBox.tsx                        # info box shown on landing + dashboard
    DateRangeFilter.tsx                 # preset + custom date range picker
    RepoList.tsx                        # searchable repo list with per-repo Generate buttons
    ChangelogDisplay.tsx                # renders markdown via react-markdown; copy + export buttons
  __tests__/
    changelog.test.ts                   # Jest unit tests for all pure functions
```

## Data Flow

1. On load, dashboard fetches `/api/repos` — returns all repos the user's GitHub token has access to.
2. User optionally sets a date range (filters `since`/`until` passed to GitHub API).
3. User clicks Generate on a repo → POST `/api/generate-changelog` with `{ repoUrl, since?, until? }`.
4. Route handler: pulls GitHub OAuth token from Clerk, fetches tags + up to 50 commits in parallel, classifies each commit with an emoji, formats with author + clickable commit link, calls Gemini 2.5 Flash.
5. Gemini groups by version tag (or month if no tags), sub-groups by emoji category, returns markdown.
6. `ChangelogDisplay` renders it with `react-markdown` — links are clickable.

## Key Notes

- Max 50 commits per request, descriptions capped at 500 chars (free tier limits).
- Commit classification (`classify`) is in `src/lib/changelog.ts` — tested in `__tests__/changelog.test.ts`.
- `toPlainText` strips markdown for `.txt` export; `formatCommitEntry` builds the prompt lines.
- Gemini 2.5 Flash returns 503 when overloaded — route handler catches it and returns a user-friendly message.
- Clerk v5 uses `auth()` synchronously in route handlers and `clerkClient()` as a function (not singleton).
