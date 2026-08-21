import { Badge } from "@/components/ui/badge";
import type { PublicSourceStatus } from "@/lib/procurement/providers";

const LABELS: Record<PublicSourceStatus, string> = {
  NEW: "New",
  WATCHING: "Watching",
  DISMISSED: "Dismissed",
  REVIEWING: "Reviewing",
  CONVERTED_TO_PURSUIT: "Pursuit started",
  CLOSED: "Closed",
};

export function PublicSourceStatusBadge({
  status,
}: {
  status: PublicSourceStatus | null | undefined;
}) {
  if (!status) return null;
  const variant =
    status === "CONVERTED_TO_PURSUIT"
      ? "secondary"
      : status === "DISMISSED" || status === "CLOSED"
        ? "outline"
        : status === "WATCHING" || status === "REVIEWING"
          ? "outline"
          : "outline";
  return (
    <Badge className="mt-1" variant={variant}>
      {LABELS[status] ?? status}
    </Badge>
  );
}

/** Derive a display status from Discover row state when the DB row is not yet loaded. */
export function discoverDisplayStatus(input: {
  status?: PublicSourceStatus | null;
  opportunity_id: string | null;
  watchlisted: boolean;
  dismissed: boolean;
}): PublicSourceStatus | null {
  if (input.status) return input.status;
  if (input.opportunity_id) return "CONVERTED_TO_PURSUIT";
  if (input.dismissed) return "DISMISSED";
  if (input.watchlisted) return "WATCHING";
  return null;
}
