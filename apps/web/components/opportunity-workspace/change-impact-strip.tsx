import Link from "next/link";
import type { ImpactSummary } from "@/lib/solicitation/impact-summary";
import {
  applyChangeItemForm,
  rejectChangeItemForm,
  verifyChangeItemForm,
} from "@/app/(platform)/procurement/opportunities/[opportunityId]/change-impact-actions";

export type ChangeImpactStripItem = {
  id: string;
  change_type: string;
  verification_status: string;
  ambiguity_reason: string | null;
  applied_at: string | null;
  before_text: string | null;
  after_text: string | null;
};

export function ChangeImpactStrip({
  opportunityId,
  summary,
  items,
  canVerify,
}: {
  opportunityId: string;
  summary: ImpactSummary;
  items: ChangeImpactStripItem[];
  canVerify: boolean;
}) {
  if (summary.items === 0) return null;

  return (
    <section
      id="solicitation-change-impact"
      className="space-y-2 rounded-md border border-amber-600/40 bg-amber-50/40 p-3 dark:bg-amber-950/20"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Solicitation change impact</h2>
        <p className="text-xs text-muted-foreground">
          {summary.unreviewed} unreviewed · {summary.verified_unapplied} verified ready ·{" "}
          {summary.applied} applied · {summary.ambiguous} ambiguous
        </p>
      </div>
      <p className="text-sm">{summary.headline}</p>
      <p className="text-xs text-muted-foreground">{summary.note}</p>
      <p className="text-xs text-muted-foreground">
        Impacts flagged: responses {summary.impacts.responses}, pricing {summary.impacts.pricing},
        deadlines {summary.impacts.deadlines}, checklist {summary.impacts.checklist}. APPROVED text and
        HUMAN_APPROVED prices are never wiped by AI.
      </p>

      {items.length > 0 ? (
        <ul className="divide-y rounded-md border bg-background text-sm">
          {items.slice(0, 8).map((item) => (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 px-2 py-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-medium">
                  {item.change_type}{" "}
                  <span className="font-normal text-muted-foreground">({item.verification_status})</span>
                </p>
                {item.ambiguity_reason ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">{item.ambiguity_reason}</p>
                ) : null}
                <p className="truncate text-xs text-muted-foreground" title={item.after_text ?? undefined}>
                  {item.before_text ? `Was: ${item.before_text.slice(0, 80)} → ` : ""}
                  {item.after_text ? item.after_text.slice(0, 100) : "(removed)"}
                </p>
              </div>
              {canVerify && !item.applied_at ? (
                <div className="flex flex-wrap gap-1">
                  {item.verification_status !== "HUMAN_VERIFIED" &&
                  item.verification_status !== "REJECTED" ? (
                    <form action={verifyChangeItemForm.bind(null, item.id)}>
                      <button type="submit" className="rounded border px-2 py-0.5 text-xs hover:bg-muted">
                        Verify
                      </button>
                    </form>
                  ) : null}
                  {item.verification_status === "HUMAN_VERIFIED" ? (
                    <form action={applyChangeItemForm.bind(null, item.id)}>
                      <button type="submit" className="rounded border px-2 py-0.5 text-xs hover:bg-muted">
                        Apply
                      </button>
                    </form>
                  ) : null}
                  {item.verification_status !== "REJECTED" ? (
                    <form action={rejectChangeItemForm.bind(null, item.id)}>
                      <button type="submit" className="rounded border px-2 py-0.5 text-xs hover:bg-muted">
                        Reject
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs">
        <Link className="underline" href={`/procurement/opportunities/${opportunityId}/requirements`}>
          Open requirements →
        </Link>
      </p>
    </section>
  );
}
