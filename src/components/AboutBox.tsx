import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function AboutBox() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p className="text-foreground">
          Generate a structured changelog from the commit history of any of your
          repositories. Commits are grouped by release version (if tags exist) or
          by date, categorized by type, and each entry includes the commit author
          and a direct link to the diff.
        </p>
        <Separator />
        <div className="space-y-1 text-xs">
          <p>⚠️ Org repos may not appear without third-party OAuth access from your org.</p>
          <p>⚠️ Currently limited to commits on the default branch (main/master).</p>
        </div>
      </CardContent>
    </Card>
  );
}
