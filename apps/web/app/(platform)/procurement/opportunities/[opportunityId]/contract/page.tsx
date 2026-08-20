import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function OpportunityContractRedirect({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (contract) {
    redirect(`/contracts/${contract.id}`);
  }
  redirect(`/procurement/opportunities/${opportunityId}/result`);
}
