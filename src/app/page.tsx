import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white px-4">
      <div className="max-w-2xl w-full text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          GitHub Changelog Tool
        </h1>
        <p className="text-xl text-gray-400">
          Paste a GitHub repo URL and get a clean, AI-generated changelog from
          its commit history.
        </p>

        <SignedOut>
          <SignInButton mode="modal">
            <button className="bg-white text-black px-8 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors">
              Sign in to get started
            </button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          <Link href="/dashboard">
            <button className="bg-white text-black px-8 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors">
              Go to Dashboard
            </button>
          </Link>
        </SignedIn>
      </div>
    </main>
  );
}
