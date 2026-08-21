import { Badge } from "@/components/ui/badge";
import type { ProviderCapability } from "@/lib/procurement/providers";
import { capabilityLabel } from "@/lib/procurement/providers";

const VARIANT: Record<ProviderCapability, "default" | "secondary" | "outline"> = {
  AUTOMATED: "default",
  MANUAL_IMPORT: "secondary",
  LINK_ONLY: "outline",
};

/** Dense capability badge for Discover / provider banners. */
export function ProviderCapabilityBadge({
  capability,
}: {
  capability: ProviderCapability;
}) {
  return (
    <Badge className="mr-1 font-normal" variant={VARIANT[capability]}>
      {capabilityLabel(capability)}
    </Badge>
  );
}
