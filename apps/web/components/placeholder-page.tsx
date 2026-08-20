export function PlaceholderPage({
  title,
  phase,
  next,
}: {
  title: string;
  phase: string;
  next: string;
}) {
  return (
    <div className="max-w-xl space-y-2">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">
        This workspace is scheduled for {phase}. {next} The rest of the operating loop (intake, verification,
        contracts, win/loss, search) is already live on other routes — this page is not a fake dashboard.
      </p>
    </div>
  );
}
