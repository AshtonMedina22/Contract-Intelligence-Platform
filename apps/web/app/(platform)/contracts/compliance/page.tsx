import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";

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
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/contracts" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          Portfolio
        </Link>
        <span>/</span>
        <span>Compliance</span>
      </div>
      <PageHeader
        title="Company compliance"
        description="Licenses, COIs/insurance, SAM/GSA/TXMAS, certifications, and personnel qualification evidence — never invented."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/contracts">View portfolio</Link>
          </Button>
        }
      />
      {(data ?? []).length > 0 ? (
        <ul className="space-y-1.5 text-sm">
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
      ) : (
        <EmptyState
          title="No compliance items"
          description="Compliance items appear here after human verification from contract documents."
        />
      )}
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
