export default function AboutBox() {
  return (
    <div className="w-full rounded-xl border border-gray-700 bg-gray-900/60 p-6 space-y-4 text-sm text-gray-300 leading-relaxed">
      <p>
        Generate a structured changelog from the commit history of any of your
        repositories. Commits are grouped by release version (if tags exist) or
        by date, categorized by type, and each entry includes the commit author
        and a direct link to the diff.
      </p>
      <div className="border-t border-gray-700 pt-4 space-y-1 text-gray-500 text-xs">
        <p>
          ⚠️ Organization repositories may not appear unless your org has granted
          third-party OAuth access.
        </p>
        <p>
          ⚠️ Changelog generation is currently limited to commits on the
          repository&apos;s default branch (main/master).
        </p>
      </div>
    </div>
  );
}
