"use client";

import { Button } from "@/components/ui/button";
import {
  editResearchFact,
  markConflictResearchFact,
  rejectResearchFact,
  verifyResearchFact,
} from "./actions";

export function ResearchFactReviewActions({
  factId,
  claim,
  excerpt,
}: {
  factId: string;
  claim: string;
  excerpt: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={verifyResearchFact}>
        <input type="hidden" name="fact_id" value={factId} />
        <Button type="submit" size="sm" variant="default">
          Verify
        </Button>
      </form>
      <form action={rejectResearchFact}>
        <input type="hidden" name="fact_id" value={factId} />
        <Button type="submit" size="sm" variant="outline">
          Reject
        </Button>
      </form>
      <form action={markConflictResearchFact} className="flex items-center gap-1">
        <input type="hidden" name="fact_id" value={factId} />
        <input type="hidden" name="note" value="Operator marked CONFLICT" />
        <Button type="submit" size="sm" variant="ghost">
          Conflict
        </Button>
      </form>
      <details className="text-xs">
        <summary className="cursor-pointer underline">Edit claim</summary>
        <form action={editResearchFact} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="fact_id" value={factId} />
          <textarea
            name="claim"
            defaultValue={claim}
            rows={2}
            className="w-full min-w-[16rem] rounded border px-2 py-1"
            required
          />
          <textarea
            name="excerpt"
            defaultValue={excerpt}
            rows={2}
            className="w-full min-w-[16rem] rounded border px-2 py-1"
          />
          <Button type="submit" size="sm" variant="secondary">
            Save → NEEDS_REVIEW
          </Button>
        </form>
      </details>
    </div>
  );
}
