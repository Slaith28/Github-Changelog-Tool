# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered changelog generator from GitHub commits. Authenticated users paste a GitHub repo URL; the app fetches the commit history via the GitHub API, sends it to Claude (Haiku) for summarisation, and displays a formatted CHANGELOG.md they can copy or download.

- GitHub remote: https://github.com/Slaith28/Github-Changelog-Tool
- Stack: Next.js 14 (App Router) · TypeScript · Tailwind CSS · Clerk (auth) · Anthropic SDK

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

## Environment Variables

Copy `.env.local` and fill in the real values before running:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard |
| `CLERK_SECRET_KEY` | Clerk dashboard |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `GITHUB_TOKEN` | Optional — raises GitHub rate limit to 5 000 req/hr |

Clerk redirect vars (`NEXT_PUBLIC_CLERK_SIGN_IN_URL`, etc.) are already set in `.env.local`.

## Architecture

```
src/
  middleware.ts                        # Clerk: protects /dashboard and /api/*
  app/
    layout.tsx                         # Root layout — wraps everything in <ClerkProvider>
    page.tsx                           # Landing page (sign-in CTA)
    sign-in/[[...sign-in]]/page.tsx    # Clerk hosted sign-in
    sign-up/[[...sign-up]]/page.tsx    # Clerk hosted sign-up
    dashboard/page.tsx                 # Main UI (client component — form + output)
    api/generate-changelog/route.ts    # POST handler: GitHub fetch → Anthropic → JSON
  components/
    RepoForm.tsx                       # URL input + submit button
    ChangelogDisplay.tsx               # Renders changelog; copy/download buttons
```

### Data flow

1. User submits a GitHub URL in `RepoForm`.
2. `dashboard/page.tsx` POSTs to `/api/generate-changelog`.
3. The route handler (`route.ts`) verifies Clerk auth, parses the URL, paginates the GitHub Commits API (up to 500 commits), then calls `claude-haiku-4-5-20251001` via the Anthropic SDK.
4. The generated Markdown is returned and rendered in `ChangelogDisplay`.

### Key implementation notes

- GitHub fetching is unauthenticated by default (60 req/hr limit); set `GITHUB_TOKEN` to raise this.
- Only the first line of each commit message is sent to the model.
- Commits are fetched newest-first; the model is instructed to keep that order.
