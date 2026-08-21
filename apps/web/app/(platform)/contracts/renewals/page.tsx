import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RenewalsTable, type AlertRow } from "../contracts-table";
import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";

async function RenewalsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view renewals.</p>;

  await supabase.rpc("refresh_contract_alerts");

  const { data, error } = await supabase
    .from("contract_alerts")
    .select("id, bucket, days_until, verified_end_on, contract_id, contracts(title)")
    .order("days_until", { ascending: true })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const rows: AlertRow[] = (data ?? []).map((row) => {
    const contract = Array.isArray(row.contracts) ? row.contracts[0] : row.contracts;
    return {
      id: row.id,
      bucket: row.bucket,
      days_until: row.days_until,
      verified_end_on: row.verified_end_on,
      contract_title: contract?.title ?? row.contract_id,
      contract_id: row.contract_id,
    };
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/contracts" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          Portfolio
        </Link>
        <span>/</span>
        <span>Renewals</span>
      </div>
      <PageHeader
        title="Renewal queue"
        description="180 / 120 / 90 / 60 / 30 / EXPIRED buckets from verified_end_on. Refreshed nightly and on load."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/contracts">View portfolio</Link>
          </Button>
        }
      />
      {rows.length > 0 ? (
        <RenewalsTable rows={rows} />
      ) : (
        <EmptyState
          title="No renewal alerts"
          description="Buckets use verified_end_on only. Contracts without verified end dates don't appear here."
        />
      )}
    </div>
  );
}

export default function RenewalsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <RenewalsContent />
    </Suspense>
  );
}
