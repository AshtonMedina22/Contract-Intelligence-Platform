"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
                  <p className="line-clamp-4">{row.statement}</p>
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
    </div>
  );
}
