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
import { updateOpportunityMetadata } from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";

export function OpportunityMetadataForm({
  opportunityId,
  stage,
  goNoGo,
  responseDueOn,
  serviceType,
  notes,
}: {
  opportunityId: string;
  stage: OpportunityStage;
  goNoGo: GoNoGo;
  responseDueOn: string | null;
  serviceType: string | null;
  notes: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="max-w-xl space-y-4 rounded-md border p-4"
      action={(formData) => {
        startTransition(async () => {
          await updateOpportunityMetadata(opportunityId, formData);
        });
      }}
    >
      <h2 className="text-sm font-medium">Pursuit metadata</h2>
      <p className="text-xs text-muted-foreground">
        Ops fields only — never inferred from AI extraction. Canonical requirements and pricing still come from
        verified promotion.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
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
          <Label htmlFor="service_type">Service type</Label>
          <Input
            id="service_type"
            name="service_type"
            list="service-type-suggestions"
            defaultValue={serviceType ?? ""}
            placeholder="Armed guards, patrol, …"
          />
          <datalist id="service-type-suggestions">
            {SERVICE_TYPE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={notes ?? ""} placeholder="Site visits, special certifications, staffing constraints…" />
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save metadata"}
      </Button>
    </form>
  );
}
