import Link from "next/link";
import type { PacketGap } from "@/lib/opportunity/proposal-packet";

export function ProposalPacketGaps({
  opportunityId,
  gaps,
}: {
  opportunityId: string;
  gaps: PacketGap[];
}) {
  const blocks = gaps.filter((g) => g.severity === "block");
  const warns = gaps.filter((g) => g.severity === "warn");

  return (
    <section className="space-y-2 rounded-md border p-4">
      <h2 className="text-sm font-medium">Missing for a complete proposal packet</h2>
      <p className="text-xs text-muted-foreground">
        This list is generated from blank fields only. It never invents dates, rates, staffing, or competitor
        numbers.
      </p>
      {gaps.length === 0 ? (
        <p className="text-sm">Packet fields that this workspace tracks are filled. Still verify source documents before submit.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {blocks.map((g) => (
            <li key={g.id}>
              <span className="text-muted-foreground">Missing · </span>
              <Link className="underline" href={`/procurement/opportunities/${opportunityId}${g.hrefSuffix}`}>
                {g.label}
              </Link>
            </li>
          ))}
          {warns.map((g) => (
            <li key={g.id} className="text-muted-foreground">
              Check ·{" "}
              <Link className="underline" href={`/procurement/opportunities/${opportunityId}${g.hrefSuffix}`}>
                {g.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
