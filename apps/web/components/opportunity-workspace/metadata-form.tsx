"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  OPPORTUNITY_STAGES,
  GO_NO_GO_OPTIONS,
  SERVICE_TYPE_SUGGESTIONS,
  type OpportunityStage,
  type GoNoGo,
} from "@/lib/opportunity/types";
import {
  PROCUREMENT_RAILS,
  SOLICITATION_KINDS,
  type ProcurementRail,
  type SolicitationKind,
} from "@/lib/opportunity/proposal-packet";
import { updateOpportunityMetadata } from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";

export function OpportunityMetadataForm({
  opportunityId,
  stage,
  goNoGo,
  responseDueOn,
  serviceType,
  notes,
  procurementRail,
  solicitationKind,
  siteLocation,
  submissionMethod,
  coverageStartOn,
  vehicleRef,
}: {
  opportunityId: string;
  stage: OpportunityStage;
  goNoGo: GoNoGo;
  responseDueOn: string | null;
  serviceType: string | null;
  notes: string | null;
  procurementRail: ProcurementRail | null;
  solicitationKind: SolicitationKind | null;
  siteLocation: string | null;
  submissionMethod: string | null;
  coverageStartOn: string | null;
  vehicleRef: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const railHint = PROCUREMENT_RAILS.find((r) => r.value === procurementRail)?.hint;

  return (
    <form
      className="max-w-3xl space-y-4 rounded-md border p-4"
      action={(formData) => {
        startTransition(async () => {
          await updateOpportunityMetadata(opportunityId, formData);
        });
      }}
    >
      <h2 className="text-sm font-medium">Pursuit packet (ops-entered)</h2>
      <p className="text-xs text-muted-foreground">
        Empty means unknown. Nothing here is inferred from AI. Canonical requirements and four-truth rates still
        come from verified promotion.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="procurement_rail">Procurement rail</Label>
          <select
            id="procurement_rail"
            name="procurement_rail"
            defaultValue={procurementRail ?? ""}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="">Unknown</option>
            {PROCUREMENT_RAILS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="solicitation_kind">Solicitation kind</Label>
          <select
            id="solicitation_kind"
            name="solicitation_kind"
            defaultValue={solicitationKind ?? ""}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="">Unknown</option>
            {SOLICITATION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="stage">Stage</Label>
          <select
            id="stage"
            name="stage"
            defaultValue={stage}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          >
            {OPPORTUNITY_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="go_no_go">Go / no-go</Label>
          <select
            id="go_no_go"
            name="go_no_go"
            defaultValue={goNoGo}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          >
            {GO_NO_GO_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="response_due_on">Response due</Label>
          <Input id="response_due_on" name="response_due_on" type="date" defaultValue={responseDueOn ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="coverage_start_on">Coverage / POP start</Label>
          <Input id="coverage_start_on" name="coverage_start_on" type="date" defaultValue={coverageStartOn ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="service_type">Service type</Label>
          <Input
            id="service_type"
            name="service_type"
            list="service-type-suggestions"
            defaultValue={serviceType ?? ""}
            placeholder="Leave blank if unknown"
          />
          <datalist id="service-type-suggestions">
            {SERVICE_TYPE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label htmlFor="site_location">Site / city</Label>
          <Input id="site_location" name="site_location" defaultValue={siteLocation ?? ""} placeholder="Leave blank if unknown" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="submission_method">Submission method</Label>
          <Input
            id="submission_method"
            name="submission_method"
            defaultValue={submissionMethod ?? ""}
            placeholder="Email, ESBD, TxSmartBuy, GSA portal…"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="vehicle_ref">Vehicle / schedule ref</Label>
          <Input
            id="vehicle_ref"
            name="vehicle_ref"
            defaultValue={vehicleRef ?? ""}
            placeholder="Only if this pursuit uses a named vehicle"
          />
        </div>
      </div>
      {railHint ? <p className="text-xs text-muted-foreground">{railHint}</p> : null}

      <div className="space-y-1">
        <Label htmlFor="notes">Special requirements / notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={notes ?? ""}
          placeholder="Licensing, insurance limits, uniforms, vehicles, union, SCA WD, site access — only what the buyer stated"
        />
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save packet"}
      </Button>
    </form>
  );
}
