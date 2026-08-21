"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  markComplianceItemHumanVerified,
  markRegistrationHumanVerified,
} from "./actions";

export function MarkCredentialVerifiedButton({
  kind,
  id,
  disabled,
}: {
  kind: "item" | "registration";
  id: string;
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
          const res =
            kind === "item"
              ? await markComplianceItemHumanVerified(id)
              : await markRegistrationHumanVerified(id);
          if (res.error) {
            window.alert(res.error);
          }
        });
      }}
    >
      {pending ? "Verifying…" : "Mark HUMAN_VERIFIED"}
    </Button>
  );
}
