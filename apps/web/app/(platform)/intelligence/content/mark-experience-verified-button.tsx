"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markExperienceHumanVerified } from "./experience-actions";

export function MarkExperienceVerifiedButton({
  id,
  disabled,
}: {
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
          const res = await markExperienceHumanVerified(id);
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
