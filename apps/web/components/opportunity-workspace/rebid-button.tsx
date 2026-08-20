"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cloneRebidFromContract } from "@/app/(platform)/contracts/actions";

export function RebidButton({ contractId }: { contractId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await cloneRebidFromContract(contractId);
        });
      }}
    >
      {pending ? "Creating…" : "Start rebid workspace"}
    </Button>
  );
}
