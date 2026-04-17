import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInButton } from "@clerk/nextjs";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { GitBranch } from "lucide-react";

export default async function Home() {
  const user = await currentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-16 relative">
      <div className="max-w-lg w-full flex flex-col items-center gap-6">

        <div className="flex items-center gap-2 text-primary mb-2">
          <GitBranch className="w-8 h-8" />
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            GitHub Changelog Tool
          </h1>
        </div>

        <p className="text-muted-foreground text-center">
          AI-powered changelogs from your commit history.
        </p>

        <Card className="w-full">
          <CardContent className="pt-6 space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p className="text-foreground">
              Connect your GitHub account and instantly generate a structured changelog
              from the commit history of any of your repositories.
            </p>
            <ul className="space-y-2">
              {[
                "Browse all your repos — public and private.",
                "Commits grouped by release version or date, categorized by type.",
                "Each entry includes the commit author and a direct link to the diff.",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-primary mt-0.5 shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Separator />
            <div className="space-y-1 text-xs">
              <p>⚠️ Org repos may not appear without third-party OAuth access from your org.</p>
              <p>⚠️ Currently limited to commits on the default branch (main/master).</p>
            </div>
          </CardContent>
          <CardFooter>
            <SignInButton mode="modal">
              <Button className="w-full" size="lg">
                Sign in with GitHub
              </Button>
            </SignInButton>
          </CardFooter>
        </Card>

      </div>

      <p className="absolute bottom-6 text-xs text-muted-foreground/50">
        Developed by Laith Shakir
      </p>
    </main>
  );
}
