"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  completeContractObligationAction,
  verifyContractObligationAction,
  waiveContractObligationAction,
} from "./actions";

export function ObligationVerifyButton({
  obligationId,
  disabled,
}: {
  obligationId: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled || pending}
      onClick={() => {
        start(async () => {
          const res = await verifyContractObligationAction(obligationId);
          if (res.error) window.alert(res.error);
        });
      }}
    >
      {pending ? "Verifying…" : "Mark HUMAN_VERIFIED"}
    </Button>
  );
}

export function ObligationCompleteForm({
  obligationId,
  disabled,
}: {
  obligationId: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [docId, setDocId] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await completeContractObligationAction(obligationId, docId.trim());
          if (res.error) window.alert(res.error);
          else setDocId("");
        });
      }}
    >
      <input
        className="h-8 min-w-[12rem] rounded-md border bg-background px-2 text-xs"
        placeholder="Evidence document UUID"
        value={docId}
        onChange={(e) => setDocId(e.target.value)}
        disabled={disabled || pending}
        required
        aria-label="Completion evidence document id"
      />
      <Button type="submit" size="sm" disabled={disabled || pending || !docId.trim()}>
        {pending ? "Completing…" : "Complete"}
      </Button>
    </form>
  );
}

export function ObligationWaiveForm({
  obligationId,
  disabled,
}: {
  obligationId: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await waiveContractObligationAction(obligationId, reason.trim());
          if (res.error) window.alert(res.error);
          else setReason("");
        });
      }}
    >
      <input
        className="h-8 min-w-[12rem] rounded-md border bg-background px-2 text-xs"
        placeholder="Waive reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={disabled || pending}
        required
        aria-label="Waive reason"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={disabled || pending || !reason.trim()}>
        {pending ? "Waiving…" : "Waive"}
      </Button>
    </form>
  );
}
