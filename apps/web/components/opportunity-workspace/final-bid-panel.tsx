"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PricingDecisionRow } from "@/lib/opportunity/types";
import type { PricingDecisionSupport } from "@/lib/opportunity/pricing-math";
import { formatMoney } from "@/lib/opportunity/pricing-math";
import { savePricingDecision } from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";

export function FinalBidPanel({
  opportunityId,
  support,
  decisions,
}: {
  opportunityId: string;
  support: PricingDecisionSupport;
  decisions: PricingDecisionRow[];
}) {
  const [pending, startTransition] = useTransition();
  const latest = decisions[0] ?? null;

  return (
    <div className="space-y-3 rounded-md border border-amber-600/40 bg-amber-50/40 p-4 dark:bg-amber-950/20">
      <div>
        <h2 className="text-sm font-medium">Final bid price — human decision required</h2>
        <p className="text-xs text-muted-foreground">
          AI and automation never approve a bid. Save draft or human-approve with an explicit rate/amount.
        </p>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Observed range</dt>
          <dd>{support.observed?.label ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cost floor</dt>
          <dd>{formatMoney(support.costFloor)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Target-margin threshold</dt>
          <dd>
            {formatMoney(support.targetThreshold)}
            {support.targetMarginPct != null ? ` (${support.targetMarginPct}%)` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Confidence / sufficiency</dt>
          <dd>
            {support.confidence} — {support.dataSufficiency}
          </dd>
        </div>
      </dl>

      {latest ? (
        <p className="text-sm">
          Latest decision: <span className="font-medium">{latest.status}</span> · rate{" "}
          {formatMoney(latest.final_bid_rate)} · amount {formatMoney(latest.final_bid_amount)}
          {latest.decided_at ? ` · ${new Date(latest.decided_at).toLocaleString()}` : null}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No human pricing decision recorded yet.</p>
      )}

      <form
        className="grid max-w-3xl gap-3 sm:grid-cols-2"
        action={(formData) => {
          startTransition(async () => {
            await savePricingDecision(opportunityId, formData);
          });
        }}
      >
        <input type="hidden" name="cost_floor" value={support.costFloor ?? ""} />
        <input type="hidden" name="target_margin_pct" value={support.targetMarginPct ?? ""} />
        <input type="hidden" name="observed_min" value={support.observed?.min ?? ""} />
        <input type="hidden" name="observed_max" value={support.observed?.max ?? ""} />
        <input type="hidden" name="observed_median" value={support.observed?.median ?? ""} />
        <input type="hidden" name="observed_n" value={support.observed?.count ?? 0} />
        <input type="hidden" name="confidence" value={support.confidence} />
        <input type="hidden" name="data_sufficiency" value={support.dataSufficiency} />
        <input
          type="hidden"
          name="include_summary"
          value={`${support.includedCount} included comparable line(s)`}
        />
        <input
          type="hidden"
          name="exclude_summary"
          value={`${support.excludedCount} excluded comparable line(s)`}
        />

        <div className="space-y-1">
          <Label htmlFor="final_bid_rate">Final bid rate</Label>
          <Input id="final_bid_rate" name="final_bid_rate" type="number" step="0.01" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="final_bid_amount">Final bid amount (optional)</Label>
          <Input id="final_bid_amount" name="final_bid_amount" type="number" step="0.01" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="rationale">Rationale</Label>
          <Input id="rationale" name="rationale" placeholder="Why this price vs cost floor / comps" />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" name="approve" value="" variant="outline" disabled={pending}>
            Save draft
          </Button>
          <Button type="submit" name="approve" value="1" disabled={pending}>
            Human-approve final bid
          </Button>
        </div>
      </form>
    </div>
  );
}
