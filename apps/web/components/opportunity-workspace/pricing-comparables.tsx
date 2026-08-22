"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { PricingComparableRow } from "@/lib/opportunity/types";
import { formatMoney, summarizeComparableRates, type RateSummary } from "@/lib/opportunity/pricing-math";
import {
  MIN_COMPARABLE_SAMPLE_FOR_CHART,
  formatCurrency,
  rangeBarModel,
  recencyLabel,
  sampleCountLabel,
} from "@/lib/opportunity/pricing-grid-model";
import { saveComparableJudgment } from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";
import { FactRef } from "./shared";

/** Which promoted truths on a comparable line carry a verified source fact. */
function verificationParts(row: PricingComparableRow): string[] {
  const parts: string[] = [];
  if (row.requested_source_fact_id) parts.push("requested");
  if (row.proposed_source_fact_id) parts.push("proposed");
  if (row.awarded_source_fact_id) parts.push("awarded");
  if (row.current_source_fact_id) parts.push("current");
  return parts;
}

export function PricingComparablesPanel({
  opportunityId,
  comparables,
  factDocumentMap,
}: {
  opportunityId: string;
  comparables: PricingComparableRow[];
  factDocumentMap: Map<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [blankReason, setBlankReason] = useState<string | null>(null);
  const included = comparables.filter((c) => c.included);
  const excluded = comparables.filter((c) => !c.included);
  const proposedSummary = summarizeComparableRates(comparables, "proposed_rate");
  const awardedSummary = summarizeComparableRates(comparables, "awarded_rate");
  const currentSummary = summarizeComparableRates(comparables, "current_rate");

  const now = useMemo(() => Date.now(), []);

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div>
        <h2 className="text-sm font-medium">Comparable evidence (include / exclude)</h2>
        <p className="text-xs text-muted-foreground">
          F22 proposes peers with purpose-versioned structured weights; compatible F21 semantics can add at most
          15 points. A human include/exclude judgment overrides the proposal and requires a reason. Similarity is
          not a winning-price prediction. Ranges use currently included rows only.
        </p>
      </div>

      {comparables.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comparable verified pricing lines yet. Ingest and verify historical packages.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <RangeCard title="L&P submitted (included)" summary={proposedSummary} />
            <RangeCard title="Buyer awarded (included)" summary={awardedSummary} />
            <RangeCard title="Current / amended (included)" summary={currentSummary} />
          </div>
          <p className="text-xs text-muted-foreground">
            Sample: {included.length} included · {excluded.length} excluded of {comparables.length}{" "}
            comparable line(s). A range bar is drawn only at n ≥ {MIN_COMPARABLE_SAMPLE_FOR_CHART}.
          </p>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs">
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">F22 score</th>
                  <th className="p-2">Source pursuit / buyer</th>
                  <th className="p-2">Why comparable</th>
                  <th className="p-2">Grain</th>
                  <th className="p-2 text-right">Proposed</th>
                  <th className="p-2 text-right">Awarded</th>
                  <th className="p-2 text-right">Current</th>
                  <th className="p-2">Verification</th>
                  <th className="p-2">Recency</th>
                  <th className="p-2">Reason / judgment</th>
                </tr>
              </thead>
              <tbody>
                {comparables.map((row) => {
                  const verified = verificationParts(row);
                  return (
                    <tr key={row.id} className="border-b align-top">
                      <td className="p-2">
                        <Badge variant={row.included ? "default" : "secondary"} className="font-normal">
                          {row.judgment_source === "HUMAN"
                            ? row.included
                              ? "Human included"
                              : "Human excluded"
                            : row.included
                              ? "Proposed include"
                              : "Proposed exclude"}
                        </Badge>
                      </td>
                      <td className="p-2 text-right text-xs tabular-nums">
                        {row.engine_score.toFixed(1)}
                        <div className="text-muted-foreground">
                          {row.structured_score.toFixed(1)} + {row.semantic_supplement.toFixed(1)}
                        </div>
                      </td>
                      <td className="p-2">
                        <Link
                          className="underline"
                          href={`/procurement/opportunities/${row.opportunity_id}/pricing`}
                        >
                          {row.opportunity_title}
                        </Link>
                        <div className="text-xs text-muted-foreground">{row.client_name ?? "buyer unknown"}</div>
                      </td>
                      <td className="p-2 text-xs">
                        {row.match_basis}
                        {row.service_type ? <div className="text-muted-foreground">{row.service_type}</div> : null}
                      </td>
                      <td className="p-2 text-xs">
                        {row.labor_category}
                        <div className="text-muted-foreground">
                          {[row.rate_type, row.unit ? `per ${row.unit}` : null, row.site_or_post]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </td>
                      <td className="p-2 text-right tabular-nums">{formatCurrency(row.proposed_rate)}</td>
                      <td className="p-2 text-right tabular-nums">{formatCurrency(row.awarded_rate)}</td>
                      <td className="p-2 text-right tabular-nums">{formatCurrency(row.current_rate)}</td>
                      <td className="p-2 text-xs">
                        {verified.length === 0 ? (
                          <span className="text-muted-foreground">no source fact</span>
                        ) : (
                          <>
                            <div>{verified.join(", ")} sourced</div>
                            <FactRef
                              factId={row.proposed_source_fact_id ?? row.awarded_source_fact_id}
                              documentId={factDocumentMap.get(
                                row.proposed_source_fact_id ?? row.awarded_source_fact_id ?? "",
                              )}
                            />
                          </>
                        )}
                      </td>
                      <td className="p-2 text-xs whitespace-nowrap">{recencyLabel(row.updated_at, now)}</td>
                      <td className="p-2">
                        <p className="mb-2 text-xs text-muted-foreground">{row.reason}</p>
                        <form
                          className="flex flex-wrap items-end gap-1"
                          action={(formData) => {
                            const reason = String(formData.get("reason") ?? "").trim();
                            if (!reason) {
                              setBlankReason(row.id);
                              return;
                            }
                            setBlankReason(null);
                            startTransition(async () => {
                              await saveComparableJudgment(opportunityId, formData);
                            });
                          }}
                        >
                          <input type="hidden" name="source_pricing_line_id" value={row.id} />
                          <input type="hidden" name="included" value={row.included ? "false" : "true"} />
                          <Input
                            name="reason"
                            required
                            aria-invalid={blankReason === row.id ? true : undefined}
                            placeholder={row.included ? "Why exclude?" : "Why include?"}
                            className="h-8 min-w-40 text-xs"
                            defaultValue=""
                          />
                          <Button type="submit" size="sm" variant="outline" disabled={pending}>
                            {row.included ? "Exclude" : "Include"}
                          </Button>
                          {blankReason === row.id ? (
                            <p className="w-full text-xs text-destructive">
                              A reason is required — include/exclude is a recorded human judgment.
                            </p>
                          ) : null}
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Range readout for one truth. The bar appears only once the included sample is large enough to
 * mean something; below that the card states n and the raw numbers instead.
 */
function RangeCard({ title, summary }: { title: string; summary: RateSummary | null }) {
  const bar = rangeBarModel(summary);
  return (
    <div className="space-y-1.5 rounded-md border p-3">
      <p className="text-xs font-medium">{title}</p>
      {summary ? (
        <>
          <p className="text-sm tabular-nums">
            {formatMoney(summary.min)} – {formatMoney(summary.max)}
          </p>
          <p className="text-xs text-muted-foreground">
            median {formatMoney(summary.median)} · avg {formatMoney(summary.avg)}
          </p>
          {bar ? (
            <div className="pt-1" aria-hidden>
              <div className="relative h-2 rounded-full bg-muted">
                <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-primary/25" />
                <div
                  className="absolute -top-0.5 h-3 w-0.5 rounded bg-primary"
                  style={{ left: `${bar.medianPercent}%` }}
                  title={`median ${formatMoney(bar.median)}`}
                />
                <div
                  className="absolute -top-0.5 h-3 w-0.5 rounded bg-muted-foreground"
                  style={{ left: `${bar.avgPercent}%` }}
                  title={`avg ${formatMoney(bar.avg)}`}
                />
              </div>
              <p className="pt-1 text-[11px] text-muted-foreground">median | avg markers</p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No range bar below n = {MIN_COMPARABLE_SAMPLE_FOR_CHART}.
            </p>
          )}
          <p className="text-xs text-muted-foreground">{sampleCountLabel(summary)}</p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">—</p>
          <p className="text-xs text-muted-foreground">{sampleCountLabel(summary)}</p>
        </>
      )}
    </div>
  );
}
