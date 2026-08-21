import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { capabilitiesForRole } from "@/lib/auth/permissions";
import type { MembershipRole } from "@/lib/supabase/database.types";
import { loadContractObligations } from "@/lib/obligations/load";
import {
  COMPLETION_EVIDENCE_NOTE,
  OBLIGATIONS_NOT_TASK_MANAGER_NOTE,
} from "@/lib/obligations/types";
import { RISK_STRIP_NOTE, formatRiskStripLabel } from "@/lib/obligations/risk-strip";
import { activeDueOn } from "@/lib/obligations/status";
import { Badge } from "@/components/ui/badge";
import {
  ObligationCompleteForm,
  ObligationVerifyButton,
  ObligationWaiveForm,
} from "./obligation-actions";

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default async function ContractObligationsPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { obligations, risk, today } = await loadContractObligations(contractId);

  let canVerify = false;
  let canComplete = false;
  if (user && obligations[0]) {
    const { data: mem } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", obligations[0].organization_id)
      .maybeSingle();
    if (mem?.role) {
      const caps = capabilitiesForRole(mem.role as MembershipRole);
      canVerify = caps.canVerifyPromote;
      canComplete = caps.canResultWrite;
    }
  } else if (user) {
    const { data: contract } = await supabase
      .from("contracts")
      .select("organization_id")
      .eq("id", contractId)
      .maybeSingle();
    if (contract) {
      const { data: mem } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("organization_id", contract.organization_id)
        .maybeSingle();
      if (mem?.role) {
        const caps = capabilitiesForRole(mem.role as MembershipRole);
        canVerify = caps.canVerifyPromote;
        canComplete = caps.canResultWrite;
      }
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground" data-testid="obligations-honesty">
        {OBLIGATIONS_NOT_TASK_MANAGER_NOTE} {RISK_STRIP_NOTE} As of {today}.
      </p>

      <div
        className="flex flex-wrap gap-3 rounded-md border px-3 py-2 text-sm"
        data-testid="obligations-risk-strip"
        title={RISK_STRIP_NOTE}
      >
        <span className="font-medium tabular-nums">{formatRiskStripLabel(risk)}</span>
        <span className="text-muted-foreground">
          verified open n={risk.verifiedOpen}
          {risk.unverifiedExcluded > 0 ? ` · unverified excluded ${risk.unverifiedExcluded}` : ""}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">{COMPLETION_EVIDENCE_NOTE}</p>

      {obligations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No contract obligations on file. Promote candidates from verified contract clauses — AI
          cannot auto-verify or auto-complete.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-sm" data-testid="obligations-table">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 pr-2 font-medium">Title</th>
                <th className="py-1.5 pr-2 font-medium">Type</th>
                <th className="py-1.5 pr-2 font-medium">Status</th>
                <th className="py-1.5 pr-2 font-medium">Due</th>
                <th className="py-1.5 pr-2 font-medium">Verification</th>
                <th className="py-1.5 pr-2 font-medium">Source</th>
                <th className="py-1.5 pr-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {obligations.map((row) => {
                const due = activeDueOn(row);
                const open =
                  row.status !== "COMPLETED" &&
                  row.status !== "WAIVED" &&
                  row.status !== "SUPERSEDED";
                return (
                  <tr key={row.id} className="border-b align-top">
                    <td className="py-2 pr-2">
                      <div className="font-medium">{row.title}</div>
                      {row.recurrence_rule ? (
                        <div className="text-xs text-muted-foreground">
                          Recurs {row.recurrence_rule}
                          {row.next_due_on ? ` · next ${row.next_due_on}` : ""}
                        </div>
                      ) : null}
                      {row.waive_reason ? (
                        <div className="text-xs text-muted-foreground">Waived: {row.waive_reason}</div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs">{row.obligation_type}</td>
                    <td className="py-2 pr-2">
                      <Badge variant={row.status === "OVERDUE" ? "destructive" : "outline"}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-2 tabular-nums">{dash(due)}</td>
                    <td className="py-2 pr-2">
                      <Badge variant={row.verification_status === "HUMAN_VERIFIED" ? "default" : "secondary"}>
                        {row.verification_status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-2 text-xs">
                      {row.source_clause_ref ? <div>{row.source_clause_ref}</div> : null}
                      {row.source_document_id ? (
                        <Link
                          className="underline"
                          href={`/ingestion/verification/${row.source_document_id}`}
                        >
                          View source
                        </Link>
                      ) : row.source_page != null ? (
                        <span>p.{row.source_page}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="space-y-1.5 py-2 pr-2">
                      {open && row.verification_status !== "HUMAN_VERIFIED" ? (
                        <ObligationVerifyButton obligationId={row.id} disabled={!canVerify} />
                      ) : null}
                      {open && row.verification_status === "HUMAN_VERIFIED" ? (
                        <>
                          <ObligationCompleteForm obligationId={row.id} disabled={!canComplete} />
                          <ObligationWaiveForm obligationId={row.id} disabled={!canComplete} />
                        </>
                      ) : null}
                      {row.completion_evidence_document_id ? (
                        <div className="text-xs text-muted-foreground">
                          Evidence{" "}
                          <Link
                            className="underline"
                            href={`/ingestion/verification/${row.completion_evidence_document_id}`}
                          >
                            {row.completion_evidence_document_id.slice(0, 8)}…
                          </Link>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
