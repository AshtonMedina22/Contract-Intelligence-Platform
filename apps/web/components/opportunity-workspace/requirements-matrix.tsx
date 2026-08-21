"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FactRef } from "./shared";
import type { RequirementMatrixRow } from "@/lib/opportunity/response";
import { updateRequirementMatrixRow } from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";

export function RequirementsMatrix({
  opportunityId,
  rows,
  factDocumentMap,
}: {
  opportunityId: string;
  rows: RequirementMatrixRow[];
  factDocumentMap: Map<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = rows.find((r) => r.id === detailId) ?? null;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No verified requirements in the matrix yet. Promote from solicitation documents.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Every requirement retains source, page/section, mandatory/scored, weight, response/form/attachment needs,
        owner, status, verification, and evidence.
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-2">Statement</th>
              <th className="p-2">Source</th>
              <th className="p-2">§ / page</th>
              <th className="p-2">Mand/Scored</th>
              <th className="p-2">Weight</th>
              <th className="p-2">Response / attach / form</th>
              <th className="p-2">Owner</th>
              <th className="p-2">Status</th>
              <th className="p-2">Save</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b align-top">
                <td className="p-2 max-w-[220px]">
                  <button
                    type="button"
                    data-testid="requirement-detail-trigger"
                    className="text-left underline-offset-2 hover:underline"
                    onClick={() => setDetailId(row.id)}
                  >
                    <span className="line-clamp-4">{row.statement}</span>
                  </button>
                  {row.verification_note ? (
                    <p className="mt-1 text-muted-foreground">Verify: {row.verification_note}</p>
                  ) : null}
                </td>
                <td className="p-2">
                  <FactRef
                    factId={row.source_fact_id}
                    documentId={factDocumentMap.get(row.source_fact_id ?? "")}
                  />
                </td>
                <td className="p-2">
                  <form
                    id={`req-${row.id}`}
                    action={(fd) => {
                      startTransition(async () => {
                        await updateRequirementMatrixRow(opportunityId, fd);
                      });
                    }}
                    className="space-y-1"
                  >
                    <input type="hidden" name="requirement_id" value={row.id} />
                    <Input
                      name="section_ref"
                      defaultValue={row.section_ref ?? ""}
                      placeholder="Section"
                      className="h-7"
                    />
                    <Input
                      name="source_page"
                      type="number"
                      defaultValue={row.source_page ?? ""}
                      placeholder="Page"
                      className="h-7"
                    />
                  </form>
                </td>
                <td className="p-2">
                  <p>{row.mandatory ? "Mandatory" : "Optional"}</p>
                  <Label className="mt-1 flex items-center gap-1 font-normal">
                    <input
                      form={`req-${row.id}`}
                      type="checkbox"
                      name="scored"
                      value="1"
                      defaultChecked={row.scored}
                    />
                    Scored
                  </Label>
                </td>
                <td className="p-2">
                  <Input
                    form={`req-${row.id}`}
                    name="weight_pct"
                    type="number"
                    step="0.01"
                    defaultValue={row.weight_pct ?? ""}
                    className="h-7 w-20"
                  />
                </td>
                <td className="p-2 space-y-1">
                  <Label className="flex items-center gap-1 font-normal">
                    <input
                      form={`req-${row.id}`}
                      type="checkbox"
                      name="response_required"
                      value="1"
                      defaultChecked={row.response_required}
                    />
                    Response
                  </Label>
                  <Label className="flex items-center gap-1 font-normal">
                    <input
                      form={`req-${row.id}`}
                      type="checkbox"
                      name="attachment_required"
                      value="1"
                      defaultChecked={row.attachment_required}
                    />
                    Attachment
                  </Label>
                  <Input
                    form={`req-${row.id}`}
                    name="form_name"
                    defaultValue={row.form_name ?? ""}
                    placeholder="Form name"
                    className="h-7"
                  />
                </td>
                <td className="p-2">
                  <Input
                    form={`req-${row.id}`}
                    name="owner_name"
                    defaultValue={row.owner_name ?? ""}
                    className="h-7"
                  />
                </td>
                <td className="p-2">
                  <select
                    form={`req-${row.id}`}
                    name="matrix_status"
                    defaultValue={row.matrix_status}
                    className="h-7 w-full rounded border bg-background"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="DRAFTING">DRAFTING</option>
                    <option value="DRAFTED">DRAFTED</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="L_AND_P_INPUT_REQUIRED">L&P INPUT REQUIRED</option>
                  </select>
                  <Input
                    form={`req-${row.id}`}
                    name="verification_note"
                    defaultValue={row.verification_note ?? ""}
                    placeholder="Verification note"
                    className="mt-1 h-7"
                  />
                </td>
                <td className="p-2">
                  <Button form={`req-${row.id}`} type="submit" size="sm" variant="outline" disabled={pending}>
                    Save
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={Boolean(detail)} onOpenChange={(open) => setDetailId(open ? detailId : null)}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle className="text-sm">Requirement detail</SheetTitle>
            <SheetDescription className="text-xs">
              Read-only view. Edit inline in the matrix; draft the response on the Response tab.
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="flex-1 space-y-3 overflow-auto p-4 text-xs">
              <p className="whitespace-pre-wrap">{detail.statement}</p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                <DetailField label="Section" value={detail.section_ref ?? "Not recorded"} />
                <DetailField label="Page" value={detail.source_page?.toString() ?? "Not recorded"} />
                <DetailField label="Mandatory" value={detail.mandatory ? "Yes" : "No"} />
                <DetailField
                  label="Scored"
                  value={detail.scored ? `Yes · ${detail.weight_pct ?? "weight not recorded"}` : "No"}
                />
                <DetailField label="Response required" value={detail.response_required ? "Yes" : "No"} />
                <DetailField
                  label="Attachment"
                  value={detail.attachment_required ? detail.form_name ?? "Required" : "Not required"}
                />
                <DetailField label="Owner" value={detail.owner_name ?? "Unassigned"} />
                <DetailField label="Matrix status" value={detail.matrix_status} />
              </dl>
              <p className="text-muted-foreground">
                Verification: {detail.verification_note ?? "No note recorded"}
              </p>
              <p>
                Source fact:{" "}
                <FactRef
                  factId={detail.source_fact_id}
                  documentId={factDocumentMap.get(detail.source_fact_id ?? "")}
                />
              </p>
              <Link
                className="inline-block underline"
                href={`/procurement/opportunities/${opportunityId}/response?req=${detail.id}`}
              >
                Open in Response workspace →
              </Link>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
