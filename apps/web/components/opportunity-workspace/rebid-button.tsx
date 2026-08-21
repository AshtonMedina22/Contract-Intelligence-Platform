"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cloneRebidFromContract } from "@/app/(platform)/contracts/actions";
import { REBID_CTA_LABEL, REBID_CTA_NOTE } from "@/lib/contracts/portfolio-model";

export function RebidButton({ contractId }: { contractId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      title={REBID_CTA_NOTE}
      data-testid="start-rebid-pursuit"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await cloneRebidFromContract(contractId);
        });
      }}
    >
      {pending ? "Creating…" : REBID_CTA_LABEL}
    </Button>
  );
}
