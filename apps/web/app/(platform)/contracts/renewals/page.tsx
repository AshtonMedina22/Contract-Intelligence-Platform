import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CONTRACT_TABS, SectionTabs } from "@/components/section-tabs";
import { RenewalsTable, type AlertRow } from "../contracts-table";

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
    <div className="space-y-4">
      <SectionTabs tabs={CONTRACT_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Renewals</h1>
        <p className="text-sm text-muted-foreground">
          180 / 120 / 90 / 60 / 30 / EXPIRED from verified_end_on. Nested: 32 days lands in the 60-day
          bucket; 20 days lands in 30. Supabase Cron refreshes nightly; this page also refreshes on load.
        </p>
      </div>
      <RenewalsTable rows={rows} />
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
