import { LIBRARY_TABS, SectionTabs } from "@/components/section-tabs";
import { PlaceholderPage } from "@/components/placeholder-page";

export default function Page() {
  return (
    <div>
      <SectionTabs tabs={LIBRARY_TABS} />
      <PlaceholderPage
        title="Exceptions"
        phase="Phase 5"
        next="Package-level validation exceptions. Open Verification for fact-level review."
      />
    </div>
  );
}
