import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlaceholderPage } from "@/components/placeholder-page";

export default function Page() {
  return (
    <div className="space-y-4">
      <PlaceholderPage
        title="Proposal workspaces"
        phase="Phase 13"
        next="Each solicitation becomes a workspace: requirements, research, pricing, evidence, draft. Until then, start with Analyze solicitation (intake) and build the verified corpus."
      />
      <Button asChild size="sm">
        <Link href="/ingestion/intake">Analyze new solicitation</Link>
      </Button>
    </div>
  );
}
