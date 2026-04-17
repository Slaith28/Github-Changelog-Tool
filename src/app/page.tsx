import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInButton } from "@clerk/nextjs";
import AboutBox from "@/components/AboutBox";

export default async function Home() {
  const user = await currentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white px-4 py-16 relative">
      <div className="max-w-xl w-full flex flex-col items-center gap-8">

        {/* title */}
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold tracking-tight">
            GitHub Changelog Tool
          </h1>
          <p className="text-gray-400 text-lg">
            AI-powered changelogs from your commit history.
          </p>
        </div>

        {/* about box */}
        <AboutBox />

        {/* sign in */}
        <SignInButton mode="modal">
          <button className="bg-white text-black px-8 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors w-full">
            Sign in with GitHub
          </button>
        </SignInButton>

      </div>

      <p className="absolute bottom-6 text-xs text-gray-600">
        Developed by Laith Shakir
      </p>
    </main>
  );
}

