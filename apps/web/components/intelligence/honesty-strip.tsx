import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  EVIDENCE_BASIS_LABELS,
  EVIDENCE_BASIS_NOTES,
  HONESTY_STRIP_TEXT,
  type EvidenceBasis,
  type ObservationTile,
} from "@/lib/intelligence/observations";
import { ASK_LAUNCH_NOTE, type AskChip } from "@/lib/intelligence/ask-launch";

/**
 * The one honesty strip every Intelligence secondary view renders directly under its PageHeader.
 * `extra` carries the sentence that is specific to a view (e.g. what a win rate would need) so the
 * shared claim and the local claim cannot drift apart.
 */
export function IntelligenceHonestyStrip({
  extra,
  className,
}: {
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      data-testid="intelligence-honesty-strip"
      className={cn(
        "border-l-2 border-muted-foreground/40 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="font-medium text-foreground">{HONESTY_STRIP_TEXT}</span>
      {extra ? <span> {extra}</span> : null}
    </p>
  );
}

export function EvidenceBasisBadge({ basis }: { basis: EvidenceBasis }) {
  return (
    <span
      title={EVIDENCE_BASIS_NOTES[basis]}
      data-basis={basis}
      className={cn(
        "inline-block border px-1 py-px text-[10px] uppercase tracking-wide",
        basis === "OBSERVED" ? "text-foreground" : "border-dashed text-muted-foreground",
      )}
    >
      {EVIDENCE_BASIS_LABELS[basis]}
    </span>
  );
}

/** Dense observation tiles. Every tile prints its own `n=` sample line. */
export function ObservationTiles({ tiles }: { tiles: ObservationTile[] }) {
  return (
    <dl
      data-testid="observation-tiles"
      className="grid grid-cols-2 gap-px border bg-border text-sm sm:grid-cols-4"
    >
      {tiles.map((tile) => (
        <div key={tile.label} className="bg-background px-2.5 py-2">
          <dt className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
            <span className="truncate">{tile.label}</span>
            <EvidenceBasisBadge basis={tile.basis} />
          </dt>
          <dd className="text-base font-semibold tabular-nums">{tile.value}</dd>
          <dd className="text-[11px] text-muted-foreground">
            <span className="tabular-nums">{tile.sample}</span>
            {" · "}
            {tile.href ? (
              <Link className="underline hover:text-foreground" href={tile.href}>
                {tile.source}
              </Link>
            ) : (
              <code>{tile.source}</code>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Contextual "Ask about this" chips. These are plain links into the existing Ask surface — there is
 * no second chat client, no second retrieval path, and no state here.
 */
export function AskAboutThis({
  chips,
  label = "Ask about this",
  className,
}: {
  chips: AskChip[];
  label?: string;
  className?: string;
}) {
  if (chips.length === 0) return null;
  return (
    <div
      data-testid="ask-about-this"
      className={cn("flex flex-wrap items-center gap-1.5 text-xs", className)}
    >
      <span className="text-muted-foreground">{label}:</span>
      {chips.map((chip) => (
        <Link
          key={chip.href}
          href={chip.href}
          title={chip.title}
          className="border px-1.5 py-0.5 hover:bg-muted"
        >
          {chip.label}
        </Link>
      ))}
      <span className="sr-only">{ASK_LAUNCH_NOTE}</span>
    </div>
  );
}
