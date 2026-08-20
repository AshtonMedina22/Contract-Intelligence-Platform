import Link from "next/link";
import { DataLayerBadge } from "@/components/data-layer-badge";
import type { TableRegistryEntry } from "@/lib/data-model/registry";

export function DataRegistryCallout({ entry }: { entry: TableRegistryEntry }) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <DataLayerBadge layer={entry.layer} />
        <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">{entry.table}</code>
        <Link className="text-xs underline" href="/system/data-model">
          Full data model
        </Link>
      </div>
      <p className="text-muted-foreground">{entry.purpose}</p>
      <p>
        <span className="font-medium">Key columns:</span>{" "}
        <span className="font-mono text-xs">{entry.keyColumns.join(" · ")}</span>
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">Fed by:</span> {entry.fedBy.join("; ")}
        </span>
        <span>
          <span className="font-medium text-foreground">Feeds:</span> {entry.feeds.join("; ")}
        </span>
      </div>
    </div>
  );
}
