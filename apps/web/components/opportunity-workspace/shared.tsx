import Link from "next/link";
import type { OpportunityStage, GoNoGo } from "@/lib/opportunity/types";
import { OPPORTUNITY_STAGES, GO_NO_GO_OPTIONS } from "@/lib/opportunity/types";
import { Badge } from "@/components/ui/badge";

export function opportunityWorkspaceTabs(opportunityId: string) {
  const base = `/procurement/opportunities/${opportunityId}`;
  return [
    { href: base, label: "Overview" },
    { href: `${base}/requirements`, label: "Requirements" },
    { href: `${base}/pricing`, label: "Pricing" },
    { href: `${base}/documents`, label: "Documents" },
    { href: `${base}/intelligence`, label: "Competitors & outcome" },
    { href: `${base}/contract`, label: "Contract" },
  ] as const;
}

function stageVariant(stage: OpportunityStage): "default" | "secondary" | "outline" | "destructive" {
  if (stage === "AWARDED") return "default";
  if (stage === "CLOSED") return "secondary";
  if (stage === "SUBMITTED") return "outline";
  return "outline";
}

function goVariant(go: GoNoGo): "default" | "secondary" | "destructive" | "outline" {
  if (go === "GO") return "default";
  if (go === "NO_GO") return "destructive";
  return "secondary";
}

export function OpportunityBadges({ stage, goNoGo }: { stage: OpportunityStage; goNoGo: GoNoGo }) {
  const stageLabel = OPPORTUNITY_STAGES.find((s) => s.value === stage)?.label ?? stage;
  const goLabel = GO_NO_GO_OPTIONS.find((g) => g.value === goNoGo)?.label ?? goNoGo;
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant={stageVariant(stage)}>{stageLabel}</Badge>
      <Badge variant={goVariant(goNoGo)}>{goLabel}</Badge>
    </div>
  );
}

export function FactRef({ factId, documentId }: { factId: string | null; documentId?: string | null }) {
  if (!factId) return <>—</>;
  if (documentId) {
    return (
      <Link className="font-mono text-xs underline" href={`/ingestion/verification/${documentId}`} title={factId}>
        {factId.slice(0, 8)}…
      </Link>
    );
  }
  return <span className="font-mono text-xs">{factId.slice(0, 8)}…</span>;
}
