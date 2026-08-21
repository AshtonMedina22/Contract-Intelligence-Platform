import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shell";
import { PursuitsNav } from "@/components/section-tabs";
import { DiscoverTable, type DiscoverRowState } from "@/components/procurement/discover-table";
import { ManualPublicEntryForm } from "@/components/procurement/manual-public-entry-form";
import { ProviderModeBanner } from "@/components/procurement/provider-mode-banner";
import { SearchProfilesPanel } from "@/components/procurement/search-profiles-panel";
import { searchPublicOpportunities } from "@/lib/procurement/providers";
import type { PublicSourceStatus } from "@/lib/procurement/providers";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  q?: string;
  buyer?: string;
  naics?: string;
  due?: string;
  postedFrom?: string;
  postedTo?: string;
};

function FilterBar({ params }: { params: SearchParams }) {
  return (
    <form className="flex flex-wrap items-end gap-2 rounded-md border p-2" method="get">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Keywords</span>
        <Input name="q" defaultValue={params.q ?? ""} placeholder="security guard" className="h-8 w-48" />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Agency / buyer</span>
        <Input name="buyer" defaultValue={params.buyer ?? ""} placeholder="agency name" className="h-8 w-44" />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">NAICS</span>
        <Input name="naics" defaultValue={params.naics ?? ""} placeholder="561612" className="h-8 w-28" />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Due within (days)</span>
        <Input name="due" type="number" min="1" defaultValue={params.due ?? ""} className="h-8 w-28" />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Posted from</span>
        <Input name="postedFrom" type="date" defaultValue={params.postedFrom ?? ""} className="h-8 w-36" />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Posted to</span>
        <Input name="postedTo" type="date" defaultValue={params.postedTo ?? ""} className="h-8 w-36" />
      </label>
      <Button size="sm" type="submit">
        Search
      </Button>
      <Button asChild size="sm" variant="ghost">
        <Link href="/procurement/opportunities/discover">Reset</Link>
      </Button>
    </form>
  );
}

async function DiscoverContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const dueRaw = Number.parseInt(params.due ?? "", 10);
  const { searches, results } = await searchPublicOpportunities({
    keywords: params.q ?? null,
    buyer: params.buyer ?? null,
    naics: params.naics ?? null,
    postedFrom: params.postedFrom ?? null,
    postedTo: params.postedTo ?? null,
    dueWithinDays: Number.isFinite(dueRaw) && dueRaw > 0 ? dueRaw : null,
    limit: 50,
  });

  // Only previously watched, dismissed, started, or sync-upserted notices exist in the database.
  // Ad-hoc Discover search results themselves are never written on view.
  const states = new Map<string, DiscoverRowState>();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profiles: {
    id: string;
    name: string;
    enabled: boolean;
    criteria: Record<string, unknown> | null;
    schedule_cron: string | null;
    last_run_at: string | null;
    last_error: string | null;
  }[] = [];

  if (user) {
    const { data: profileRows } = await supabase
      .from("opportunity_search_profiles")
      .select("id, name, enabled, criteria, schedule_cron, last_run_at, last_error")
      .order("name")
      .limit(50);
    profiles = (profileRows ?? []).map((row) => ({
      ...row,
      criteria: (row.criteria ?? null) as Record<string, unknown> | null,
    }));

    if (results.length > 0) {
      const { data: known } = await supabase
        .from("public_sources")
        .select("id, provider, external_id, watchlisted_at, dismissed_at, status")
        .in(
          "external_id",
          results.map((row) => row.external_id),
        );
      const { data: started } = await supabase
        .from("opportunities")
        .select("id, external_provider, external_source_id")
        .not("external_source_id", "is", null);
      const startedBy = new Map(
        (started ?? []).map((row) => [`${row.external_provider}:${row.external_source_id}`, row.id]),
      );
      for (const row of known ?? []) {
        const key = `${row.provider}:${row.external_id}`;
        states.set(key, {
          public_source_id: row.id,
          watchlisted: row.watchlisted_at != null,
          dismissed: row.dismissed_at != null || row.status === "DISMISSED",
          opportunity_id: startedBy.get(key) ?? null,
          status: row.status as PublicSourceStatus,
        });
      }
    }
  }

  const visible = results.filter((row) => {
    const state = states.get(`${row.provider}:${row.external_id}`);
    return !(state?.dismissed || state?.status === "DISMISSED");
  });

  return (
    <>
      <PursuitsNav />
      <div className="space-y-4">
        <PageHeader
          title="Discover public opportunities"
          description="Search configured public procurement providers. Ad-hoc search is not saved on view; sync profiles upsert provider hits only. No fit score is ever computed."
          actions={
            <Button asChild size="sm" variant="outline">
              <Link href="/procurement/opportunities/watchlist">Watchlist</Link>
            </Button>
          }
        />
        <FilterBar params={params} />
        <ProviderModeBanner searches={searches} />
        <ManualPublicEntryForm />
        {user ? <SearchProfilesPanel profiles={profiles} /> : null}
        <DiscoverTable notices={visible} states={states} />
      </div>
    </>
  );
}

export default function DiscoverPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Searching providers…</p>}>
      <DiscoverContent searchParams={searchParams} />
    </Suspense>
  );
}
