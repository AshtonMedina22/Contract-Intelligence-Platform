import { Suspense } from "react";
import { PursuitsList } from "@/components/pursuits/pursuits-list";
import { PursuitsNav } from "@/components/section-tabs";

export default function ClosedPursuitsPage() {
  return (
    <>
      <PursuitsNav />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <PursuitsList view="closed" />
      </Suspense>
    </>
  );
}
