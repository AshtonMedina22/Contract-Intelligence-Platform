import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OpportunityWorkspaceShell } from "@/components/opportunity-workspace/workspace-shell";
import { loadOpportunityHeader, loadWorkspaceSummary } from "@/lib/opportunity/load-workspace";
import { PROCUREMENT_TABS, SectionTabs } from "@/components/section-tabs";

async function WorkspaceLayoutInner({
  opportunityId,
  children,
}: {
  opportunityId: string;
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="space-y-4">
        <SectionTabs tabs={PROCUREMENT_TABS} />
        <p className="text-sm">Sign in to open this workspace.</p>
      </div>
    );
  }

  const [opportunity, summary] = await Promise.all([
    loadOpportunityHeader(opportunityId),
    loadWorkspaceSummary(opportunityId),
  ]);
  if (!opportunity) notFound();

  return (
    <div className="space-y-4">
      <SectionTabs tabs={PROCUREMENT_TABS} />
      <p className="text-xs text-muted-foreground">
        <Link className="underline" href="/proposals">
          All proposal workspaces
        </Link>
        {" · "}
        <Link className="underline" href="/procurement/opportunities">
          Opportunities list
        </Link>
      </p>
      <OpportunityWorkspaceShell opportunity={opportunity} summary={summary}>
        {children}
      </OpportunityWorkspaceShell>
    </div>
  );
}

export default function OpportunityWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ opportunityId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading workspace…</p>}>
      <LayoutFromParams params={params}>{children}</LayoutFromParams>
    </Suspense>
  );
}

async function LayoutFromParams({
  params,
  children,
}: {
  params: Promise<{ opportunityId: string }>;
  children: React.ReactNode;
}) {
  const { opportunityId } = await params;
  return <WorkspaceLayoutInner opportunityId={opportunityId}>{children}</WorkspaceLayoutInner>;
}
