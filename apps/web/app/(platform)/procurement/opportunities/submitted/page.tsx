import { Suspense } from "react";
import { PursuitsList } from "@/components/pursuits/pursuits-list";
import { PursuitsNav } from "@/components/section-tabs";

export default function SubmittedPursuitsPage() {
  return (
    <>
      <PursuitsNav />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <PursuitsList view="submitted" />
      </Suspense>
    </>
  );
}
