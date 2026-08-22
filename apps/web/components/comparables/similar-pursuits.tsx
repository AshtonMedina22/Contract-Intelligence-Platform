import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { COMPARABLE_CAUSATION_CAVEAT, type ComparableScore } from "@/lib/comparables";

export function SimilarPursuits({
  scores,
  title = "Similar historical pursuits",
  empty = "No authority-eligible historical peers have enough recorded fields to rank.",
  linkSuffix = "",
}: {
  scores: ComparableScore[];
  title?: string;
  empty?: string;
  linkSuffix?: string;
}) {
  return (
    <section className="space-y-2 rounded-md border p-3" data-testid="similar-pursuits">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">
          Structured score first (maximum 85) plus an optional compatible F21 semantic supplement (maximum 15).
          {` ${COMPARABLE_CAUSATION_CAVEAT}`}
        </p>
      </div>
      {scores.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {scores.map((score) => (
            <li key={score.candidate.id} className="rounded border p-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  className="font-medium underline"
                  href={`/procurement/opportunities/${score.candidate.id}${linkSuffix}`}
                >
                  {score.candidate.title}
                </Link>
                <Badge variant="outline">{score.totalScore.toFixed(1)} / 100</Badge>
                <Badge variant="secondary">{score.candidate.authority.historicalLabel}</Badge>
                <span className="text-xs text-muted-foreground">
                  structured {score.structuredScore.toFixed(1)} · semantic +{score.semanticSupplement.toFixed(1)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {score.candidate.clientName ?? "Buyer missing"} · {score.candidate.serviceType ?? "Service missing"} ·{" "}
                {score.candidate.siteLocation ?? "Geography missing"}
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {score.rationale.slice(0, 3).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              {score.coverageWeight < 85 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Missing fields contributed 0 points; observed weighted coverage {score.coverageWeight}/85.
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
