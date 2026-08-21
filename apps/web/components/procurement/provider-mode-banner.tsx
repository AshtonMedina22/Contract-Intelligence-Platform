import type { PublicProviderSearchResult } from "@/lib/procurement/providers";
import { ProviderCapabilityBadge } from "@/components/procurement/provider-capability-badge";

/**
 * Discovery honesty banner. Operators must always be able to tell whether they are looking at
 * live public notices or clearly labeled sample fixtures, and what capability each adapter has.
 */
export function ProviderModeBanner({ searches }: { searches: PublicProviderSearchResult[] }) {
  if (searches.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {searches.map((search) => (
        <div
          key={`${search.provider}-${search.mode}-${search.capability}`}
          className={
            search.mode === "fixture"
              ? "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
              : "rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          }
        >
          <span className="font-medium uppercase tracking-wide">
            {search.mode === "fixture" ? "Sample data" : "Live"} · {search.provider}
          </span>
          <span className="ml-2 inline-flex items-center align-middle">
            <ProviderCapabilityBadge capability={search.capability} />
          </span>
          <span className="ml-1">{search.notice}</span>
          {search.error ? <p className="mt-1 font-medium text-red-700">{search.error}</p> : null}
        </div>
      ))}
    </div>
  );
}
