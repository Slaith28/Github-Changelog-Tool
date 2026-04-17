import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let githubToken: string | null = null;
  try {
    const client = clerkClient();
    const response = await client.users.getUserOauthAccessToken(userId, "oauth_github");
    const tokenData = response as { data?: Array<{ token: string }> } | Array<{ token: string }>;
    githubToken =
      (Array.isArray(tokenData) ? tokenData[0]?.token : tokenData.data?.[0]?.token) ?? null;
  } catch {
    return NextResponse.json({ error: "Could not retrieve GitHub token" }, { status: 400 });
  }

  if (!githubToken) {
    return NextResponse.json({ error: "GitHub token not available — try signing out and back in" }, { status: 400 });
  }

  // fetch all repos the user has access to, sorted by most recently updated
  const res = await fetch(
    "https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member",
    {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "github-changelog-tool",
      },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch repositories from GitHub" }, { status: res.status });
  }

  const repos = await res.json();
  return NextResponse.json({ repos });
}
