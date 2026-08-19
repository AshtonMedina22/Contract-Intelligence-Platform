export function PlaceholderPage({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <div className="max-w-2xl space-y-2">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">
        Not built yet. This screen is a Phase 1 navigation placeholder. See{" "}
        <code className="text-xs">docs/BUILD_PLAN.md</code> ({phase}).
      </p>
    </div>
  );
}
