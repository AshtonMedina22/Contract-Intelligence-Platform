import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CONTRACT_TABS, SectionTabs } from "@/components/section-tabs";

async function ComplianceContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view compliance.</p>;

  const { data, error } = await supabase
    .from("compliance_items")
    .select("id, kind, statement, expires_on, contract_id, contracts(title)")
    .order("expires_on", { ascending: true })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  return (
    <div className="space-y-4">
      <SectionTabs tabs={CONTRACT_TABS} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Compliance</h1>
        <p className="text-sm text-muted-foreground">Insurance, license, and certification facts after human verify.</p>
      </div>
      <ul className="space-y-2 text-sm">
        {(data ?? []).map((row) => {
          const contract = Array.isArray(row.contracts) ? row.contracts[0] : row.contracts;
          return (
            <li key={row.id}>
              <span className="font-medium">{row.kind}</span> — {row.statement}
              {row.expires_on ? ` · expires ${row.expires_on}` : ""}
              {row.contract_id ? (
                <>
                  {" "}
                  <Link className="underline" href={`/contracts/${row.contract_id}`}>
                    {contract?.title ?? "contract"}
                  </Link>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
      {(data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">None promoted yet.</p>
      ) : null}
    </div>
  );
}

export default function CompliancePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ComplianceContent />
    </Suspense>
  );
}
