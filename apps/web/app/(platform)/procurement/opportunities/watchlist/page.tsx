import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/shell";
import { PursuitsNav } from "@/components/section-tabs";
import { createClient } from "@/lib/supabase/server";
import {
  dismissOpportunity,
  startPursuitAndOpen,
  undismissOpportunity,
} from "../discover/actions";

export default function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ dismissed?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading watchlist…</p>}>
      <WatchlistContent searchParams={searchParams} />
    </Suspense>
  );
}

async function WatchlistContent({
  searchParams,
}: {
  searchParams: Promise<{ dismissed?: string }>;
}) {
  const showDismissed = (await searchParams).dismissed === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view the watchlist.</p>;

  const query = supabase
    .from("public_sources")
    .select(
      "id, provider, external_id, title, source_url, buyer_name, solicitation_number, procurement_type, naics, psc, set_aside, geography, posted_on, due_on, estimated_value, watchlisted_at, dismissed_at",
    )
    .order("due_on", { ascending: true, nullsFirst: false })
    .limit(200);
  const { data, error } = showDismissed
    ? await query.not("dismissed_at", "is", null)
    : await query.not("watchlisted_at", "is", null).is("dismissed_at", null);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const rows = data ?? [];
  const { data: started } = await supabase
    .from("opportunities")
    .select("id, public_source_id")
    .not("public_source_id", "is", null);
  const startedBy = new Map(
    (started ?? [])
      .filter((row) => row.public_source_id)
      .map((row) => [row.public_source_id as string, row.id]),
  );

  return (
    <>
      <PursuitsNav />
      <div className="space-y-4">
        <PageHeader
          title={showDismissed ? "Dismissed notices" : "Watchlist"}
          description="Public notices you chose to track. These are external public records — the solicitation still has to be ingested and verified before any of these values count."
          actions={
            <div className="flex gap-2">
              <Button asChild size="sm" variant="ghost">
                <Link
                  href={
                    showDismissed
                      ? "/procurement/opportunities/watchlist"
                      : "/procurement/opportunities/watchlist?dismissed=1"
                  }
                >
                  {showDismissed ? "Back to watchlist" : "Show dismissed"}
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/procurement/opportunities/discover">Discover</Link>
              </Button>
            </div>
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            title={showDismissed ? "No dismissed notices" : "Nothing on the watchlist"}
            description="Watch a notice from Discover to track it here. Discovery results are never saved automatically."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/procurement/opportunities/discover">Go to Discover</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-2 py-1.5">Notice ({rows.length})</th>
                  <th className="px-2 py-1.5">Buyer as listed</th>
                  <th className="px-2 py-1.5">Provider</th>
                  <th className="px-2 py-1.5">NAICS / PSC</th>
                  <th className="px-2 py-1.5">Place</th>
                  <th className="px-2 py-1.5">Due</th>
                  <th className="px-2 py-1.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const opportunityId = startedBy.get(row.id) ?? null;
                  return (
                    <tr key={row.id} className="border-b align-top">
                      <td className="px-2 py-1.5">
                        {row.source_url ? (
                          <a
                            className="font-medium underline"
                            href={row.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {row.title}
                          </a>
                        ) : (
                          <span className="font-medium">{row.title}</span>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {row.solicitation_number ?? row.external_id}
                          {row.procurement_type ? ` · ${row.procurement_type}` : ""}
                        </p>
                        {row.dismissed_at ? (
                          <Badge className="mt-1" variant="outline">
                            Dismissed
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{row.buyer_name ?? "—"}</td>
                      <td className="px-2 py-1.5 text-xs">
                        <Badge variant={row.provider === "fixture" ? "outline" : "secondary"}>
                          {row.provider === "fixture" ? "sample" : row.provider}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">
                        {row.naics ?? "—"}
                        {row.psc ? ` / ${row.psc}` : ""}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">{row.geography ?? "—"}</td>
                      <td className="px-2 py-1.5 text-xs">{row.due_on ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {opportunityId ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/procurement/opportunities/${opportunityId}`}>Review pursuit</Link>
                            </Button>
                          ) : (
                            <form action={startPursuitAndOpen}>
                              <input type="hidden" name="public_source_id" value={row.id} />
                              <Button size="sm" type="submit">
                                Start pursuit
                              </Button>
                            </form>
                          )}
                          {row.dismissed_at ? (
                            <form action={undismissOpportunity}>
                              <input type="hidden" name="public_source_id" value={row.id} />
                              <Button size="sm" variant="ghost" type="submit">
                                Restore
                              </Button>
                            </form>
                          ) : (
                            <form action={dismissOpportunity}>
                              <input type="hidden" name="public_source_id" value={row.id} />
                              <Button size="sm" variant="ghost" type="submit">
                                Dismiss
                              </Button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
