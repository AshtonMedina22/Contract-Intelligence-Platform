import { Badge } from "@/components/ui/badge";
import { LAYER_LABELS, type DataLayer } from "@/lib/data-model/registry";
import { cn } from "@/lib/utils";

const VARIANT: Record<DataLayer, string> = {
  staging: "border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100",
  canonical: "border-emerald-500/50 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100",
  derived: "border-sky-500/50 bg-sky-500/10 text-sky-950 dark:text-sky-100",
  intelligence: "border-violet-500/50 bg-violet-500/10 text-violet-950 dark:text-violet-100",
  system: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function DataLayerBadge({ layer, className }: { layer: DataLayer; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-normal", VARIANT[layer], className)}>
      {LAYER_LABELS[layer]}
    </Badge>
  );
}
