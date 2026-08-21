"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cloneRebidFromContract } from "@/app/(platform)/contracts/actions";
import { REBID_CTA_LABEL, REBID_CTA_NOTE } from "@/lib/contracts/portfolio-model";

export function RebidButton({
  contractId,
  canRebidClone = true,
}: {
  contractId: string;
  canRebidClone?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canRebidClone) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="start-rebid-pursuit-denied">
        Rebid requires admin, bidder, or executive.
      </p>
    );
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        title={REBID_CTA_NOTE}
        data-testid="start-rebid-pursuit"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            try {
              setError(null);
              await cloneRebidFromContract(contractId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Rebid failed.");
            }
          });
        }}
      >
        {pending ? "Creating…" : REBID_CTA_LABEL}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </>
  );
}
