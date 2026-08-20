import Link from "next/link";
import { Suspense } from "react";
import { DataLayerBadge } from "@/components/data-layer-badge";
import {
  LAYER_LABELS,
  RFQ_FLOW_STEPS,
  tablesForLayer,
  type DataLayer,
} from "@/lib/data-model/registry";

const LAYER_ORDER: DataLayer[] = ["staging", "canonical", "derived", "intelligence", "system"];

function DataModelContent() {
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Data model</h1>
        <p className="text-sm text-muted-foreground">
          What Postgres stores, which columns matter, and how verified data flows into outputs when you prepare a
          new RFQ. Every live page below links to real rows — not a mock dashboard.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">New RFQ: data → output</h2>
        <ol className="space-y-2 border-l-2 pl-4">
          {RFQ_FLOW_STEPS.map((row) => (
            <li key={row.step} className="text-sm">
              <span className="font-medium">
                {row.step}. {row.label}
              </span>
              <span className="text-muted-foreground"> — table </span>
              <code className="font-mono text-xs">{row.table}</code>
              <span className="text-muted-foreground"> → </span>
              {row.output}
              <div>
                <Link className="text-xs underline" href={row.route}>
                  Open live view
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Four commercial truths (never one rate field)</h2>
        <div className="overflow-x-auto rounded-md border text-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2">Truth</th>
                <th className="p-2">Document tag</th>
                <th className="p-2">pricing_lines column</th>
                <th className="p-2">Live view</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2">Requested</td>
                <td className="p-2 font-mono text-xs">commercial_truth = REQUESTED</td>
                <td className="p-2 font-mono text-xs">requested_rate</td>
                <td className="p-2">
                  <Link className="underline" href="/procurement/requirements">
                    Requirements
                  </Link>
                </td>
              </tr>
              <tr className="border-b">
                <td className="p-2">Proposed</td>
                <td className="p-2 font-mono text-xs">PROPOSED</td>
                <td className="p-2 font-mono text-xs">proposed_rate</td>
                <td className="p-2">
                  <Link className="underline" href="/intelligence/pricing">
                    Pricing lines
                  </Link>
                </td>
              </tr>
              <tr className="border-b">
                <td className="p-2">Awarded</td>
                <td className="p-2 font-mono text-xs">AWARDED</td>
                <td className="p-2 font-mono text-xs">awarded_rate · awards table</td>
                <td className="p-2">
                  <Link className="underline" href="/procurement/opportunities">
                    Opportunities
                  </Link>
                </td>
              </tr>
              <tr>
                <td className="p-2">Current</td>
                <td className="p-2 font-mono text-xs">CURRENT</td>
                <td className="p-2 font-mono text-xs">current_rate · contracts</td>
                <td className="p-2">
                  <Link className="underline" href="/contracts">
                    Contracts
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {LAYER_ORDER.map((layer) => {
        const tables = tablesForLayer(layer);
        if (tables.length === 0) return null;
        return (
          <section key={layer} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">{LAYER_LABELS[layer]}</h2>
              <DataLayerBadge layer={layer} />
            </div>
            <div className="space-y-3">
              {tables.map((entry) => (
                <div key={entry.table} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-xs font-semibold">{entry.table}</code>
                    <Link className="text-xs underline" href={entry.liveRoute}>
                      View rows
                    </Link>
                  </div>
                  <p className="mt-1 text-muted-foreground">{entry.purpose}</p>
                  <p className="mt-2 font-mono text-xs">{entry.keyColumns.join(" · ")}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">In:</span> {entry.fedBy.join("; ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Out:</span> {entry.feeds.join("; ")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="text-sm font-medium text-foreground">Not exposed in UI yet</h2>
        <ul className="list-inside list-disc">
          <li>
            <code className="text-xs">verification_events</code> — full verify audit trail
          </li>
          <li>
            <code className="text-xs">source_evidence</code> — bbox anchors per fact
          </li>
          <li>
            <code className="text-xs">batch_ingest_items</code> — per-file bulk outcomes
          </li>
          <li>
            <code className="text-xs">proposals</code> — Phase 13 workspace tables
          </li>
        </ul>
      </section>
    </div>
  );
}

export default function DataModelPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <DataModelContent />
    </Suspense>
  );
}
