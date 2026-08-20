import { formatMoney } from "@/lib/opportunity/pricing-math";
import type { FulfillmentEconomics } from "@/lib/opportunity/proposal-packet";

export function FulfillmentEconomicsPanel({ economics }: { economics: FulfillmentEconomics }) {
  return (
    <section className="space-y-2 rounded-md border p-4">
      <h2 className="text-sm font-medium">Fulfillment economics (planning)</h2>
      <p className="text-xs text-muted-foreground">
        Weekly hours from staffing × loaded cost and planned rate from cost models you typed. Blank wage or
        unmatched labor category = excluded, not guessed.
      </p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Weekly hours</dt>
          <dd>{economics.weeklyHours == null ? "—" : economics.weeklyHours}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Weekly cost (loaded)</dt>
          <dd>{formatMoney(economics.weeklyCost)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Weekly planned bill</dt>
          <dd>{formatMoney(economics.weeklyRevenue)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Weekly margin</dt>
          <dd>
            {formatMoney(economics.weeklyMargin)}
            {economics.marginPct != null ? ` (${economics.marginPct.toFixed(1)}%)` : ""}
          </dd>
        </div>
      </dl>
      {economics.unmatchedPosts.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Excluded posts: {economics.unmatchedPosts.join(", ")}
        </p>
      ) : null}
      <ul className="list-disc pl-5 text-xs text-muted-foreground">
        {economics.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  );
}
