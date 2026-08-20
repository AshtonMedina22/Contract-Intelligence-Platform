import { Suspense } from "react";
import { PursuitsList } from "@/components/pursuits/pursuits-list";

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <PursuitsList />
    </Suspense>
  );
}
