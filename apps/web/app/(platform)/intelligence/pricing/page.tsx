import { IntelligenceNav } from "@/components/section-tabs";
import { PlaceholderPage } from "@/components/placeholder-page";

export default function Page() {
  return (
    <div>
      <IntelligenceNav />
      <PlaceholderPage
        title="Pricing intelligence"
        phase="Phase 12"
        next="Glide comparable workbench on verified price lines — not invented rates."
      />
    </div>
  );
}
