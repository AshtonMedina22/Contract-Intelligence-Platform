import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  EXPERIENCE_HARD_CAVEAT,
  EXPERIENCE_TYPE_LABELS,
  hasExperienceSource,
  type ExperienceRecord,
  type ExperienceType,
} from "@/lib/experience/types";
import { MarkExperienceVerifiedButton } from "./mark-experience-verified-button";

function sourceHref(row: ExperienceRecord): string | null {
  if (row.source_document_id) return `/ingestion/verification/${row.source_document_id}`;
  if (row.source_url) return row.source_url;
  return null;
}

function typeBadgeVariant(type: string): "default" | "secondary" | "outline" | "destructive" {
  if (type === "L_AND_P_CORPORATE") return "default";
  if (type === "SUBCONTRACTOR_EXPERIENCE") return "secondary";
  return "outline";
}

export function ExperienceLibraryTable({
  rows,
  canVerify,
}: {
  rows: ExperienceRecord[];
  canVerify: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No experience records yet. Promote from an L&P-held contract (L_AND_P_CORPORATE only) or
        extract typed management / personnel / subcontractor rows. {EXPERIENCE_HARD_CAVEAT}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">{EXPERIENCE_HARD_CAVEAT}</p>
      <div className="overflow-x-auto border">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-1.5 font-medium">Type</th>
              <th className="p-1.5 font-medium">Project / contract</th>
              <th className="p-1.5 font-medium">Buyer</th>
              <th className="p-1.5 font-medium">Attribution</th>
              <th className="p-1.5 font-medium">Value</th>
              <th className="p-1.5 font-medium">Verification</th>
              <th className="p-1.5 font-medium">Source</th>
              <th className="p-1.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = sourceHref(row);
              const label =
                EXPERIENCE_TYPE_LABELS[row.experience_type as ExperienceType] ??
                String(row.experience_type);
              const valueCell =
                row.contract_value_amount != null && row.contract_value_source
                  ? `${row.contract_value_currency ?? "USD"} ${row.contract_value_amount}`
                  : "—";
              return (
                <tr key={row.id} className="border-b last:border-0 align-top">
                  <td className="p-1.5">
                    <Badge variant={typeBadgeVariant(String(row.experience_type))}>{label}</Badge>
                  </td>
                  <td className="p-1.5">
                    <div>{row.project_or_contract_name}</div>
                    {row.contract_number ? (
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {row.contract_number}
                      </div>
                    ) : null}
                    {row.person_name ? (
                      <div className="text-[10px] text-muted-foreground">Person: {row.person_name}</div>
                    ) : null}
                    {row.employer_name ? (
                      <div className="text-[10px] text-muted-foreground">
                        Employer: {row.employer_name}
                      </div>
                    ) : null}
                    {row.subcontractor_name ? (
                      <div className="text-[10px] text-muted-foreground">
                        Sub: {row.subcontractor_name}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-1.5">{row.buyer_name ?? "—"}</td>
                  <td className="p-1.5 max-w-[220px] text-muted-foreground">
                    {row.attribution_language}
                  </td>
                  <td className="p-1.5">{valueCell}</td>
                  <td className="p-1.5">{row.verification_status}</td>
                  <td className="p-1.5">
                    {href ? (
                      <Link href={href} className="underline underline-offset-2">
                        View Source
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-1.5">
                    {canVerify && row.verification_status !== "HUMAN_VERIFIED" ? (
                      <MarkExperienceVerifiedButton
                        id={row.id}
                        disabled={!hasExperienceSource(row)}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
