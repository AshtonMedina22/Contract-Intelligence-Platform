import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlaceholderPage } from "@/components/placeholder-page";

export default function Page() {
  return (
    <div className="space-y-4">
      <PlaceholderPage
        title="Proposal workspaces"
        phase="Phase 13"
        next="Each active solicitation becomes a workspace: requirements, research, pricing, evidence, draft. Until then, start at Ingestion → Intake and link documents to an opportunity."
      />
      <div className="flex flex-wrap gap-2 text-sm">
        <Button asChild size="sm">
          <Link href="/ingestion/intake">Analyze new solicitation</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/procurement/opportunities">View opportunities</Link>
        </Button>
      </div>
    </div>
  );
}
