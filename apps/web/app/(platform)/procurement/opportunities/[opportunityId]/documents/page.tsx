import { redirect } from "next/navigation";

export default async function OpportunityDocumentsRedirect({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  redirect(`/procurement/opportunities/${opportunityId}/submission`);
}
