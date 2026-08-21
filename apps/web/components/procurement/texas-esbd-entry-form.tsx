import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitTexasEsbdEntry } from "@/app/(platform)/procurement/opportunities/discover/actions";
import { TEXAS_ESBD_PORTAL_URL } from "@/lib/procurement/providers";

/**
 * Texas ESBD entry — LINK_ONLY portal + MANUAL_IMPORT paste.
 * Does not scrape TxSmartBuy; operator opens the portal and pastes fields.
 */
export function TexasEsbdEntryForm() {
  return (
    <details className="rounded-md border p-2">
      <summary className="cursor-pointer text-sm font-medium">
        Texas ESBD — link + manual import
      </summary>
      <p className="mt-1 text-xs text-muted-foreground">
        ESBD has no public solicitation API. Open{" "}
        <a
          className="underline"
          href={TEXAS_ESBD_PORTAL_URL}
          target="_blank"
          rel="noreferrer"
        >
          TxSmartBuy ESBD
        </a>
        , then paste the notice below. Sync will never scrape ESBD.
      </p>
      <form action={submitTexasEsbdEntry} className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Title *</span>
          <Input name="title" required className="h-8 w-64" placeholder="ESBD solicitation title" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Source URL</span>
          <Input name="source_url" className="h-8 w-64" placeholder="https://www.txsmartbuy.com/…" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Buyer as listed</span>
          <Input name="buyer_name" className="h-8 w-44" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Solicitation #</span>
          <Input name="solicitation_number" className="h-8 w-36" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Due</span>
          <Input name="due_on" type="date" className="h-8 w-36" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Place</span>
          <Input name="geography" defaultValue="TX" className="h-8 w-36" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">NAICS</span>
          <Input name="naics" className="h-8 w-28" />
        </label>
        <Button size="sm" type="submit" name="intent" value="watch" variant="outline">
          Watch
        </Button>
        <Button size="sm" type="submit" name="intent" value="start">
          Start pursuit
        </Button>
      </form>
    </details>
  );
}
