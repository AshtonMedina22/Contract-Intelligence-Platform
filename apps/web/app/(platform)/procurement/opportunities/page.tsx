import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PROCUREMENT_TABS, SectionTabs } from "@/components/section-tabs";

async function OpportunitiesContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view opportunities.</p>;

  const { data, error } = await supabase
    .from("opportunities")
    .select("id, title, created_at, clients(name)")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  return (
    <div className="space-y-4">
      <SectionTabs tabs={PROCUREMENT_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          Package view holds four commercial truths. Requested is not overwritten by award.
        </p>
      </div>
      <ul className="space-y-2 text-sm">
        {(data ?? []).map((row) => {
          const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
          return (
            <li key={row.id}>
              <Link className="underline" href={`/procurement/opportunities/${row.id}`}>
                {row.title}
              </Link>
              <span className="text-muted-foreground"> — {client?.name ?? "no client"}</span>
            </li>
          );
        })}
      </ul>
      {(data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">None yet. Verify identity fields to create them.</p>
      ) : null}
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <OpportunitiesContent />
    </Suspense>
  );
}
