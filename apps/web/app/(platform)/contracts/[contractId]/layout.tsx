import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContractWorkspaceShell } from "@/components/contract-workspace/workspace-shell";

async function LayoutInner({
  contractId,
  children,
}: {
  contractId: string;
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view this contract.</p>;

  const { data: contract, error } = await supabase
    .from("contracts")
    .select("id, title, contract_number, clients(name)")
    .eq("id", contractId)
    .maybeSingle();
  if (error || !contract) notFound();

  const client = Array.isArray(contract.clients) ? contract.clients[0] : contract.clients;

  return (
    <ContractWorkspaceShell
      contractId={contract.id}
      title={contract.title}
      clientName={client?.name ?? null}
      contractNumber={contract.contract_number}
    >
      {children}
    </ContractWorkspaceShell>
  );
}

export default function ContractWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ contractId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading contract…</p>}>
      <FromParams params={params}>{children}</FromParams>
    </Suspense>
  );
}

async function FromParams({
  params,
  children,
}: {
  params: Promise<{ contractId: string }>;
  children: React.ReactNode;
}) {
  const { contractId } = await params;
  return <LayoutInner contractId={contractId}>{children}</LayoutInner>;
}
