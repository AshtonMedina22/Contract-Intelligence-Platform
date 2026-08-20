import { PlaceholderPage } from "@/components/placeholder-page";
import { PROCUREMENT_TABS, SectionTabs } from "@/components/section-tabs";

export default function Page() {
  return (
    <div className="space-y-4">
      <SectionTabs tabs={PROCUREMENT_TABS} />
      <PlaceholderPage
      title="Clients"
      phase="Phase 2+"
      next="Client rows are created during intake and settings. Directory filters come after more packages exist."
      />
    </div>
  );
}
