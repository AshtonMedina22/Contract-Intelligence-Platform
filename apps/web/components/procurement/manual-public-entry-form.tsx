import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitManualPublicEntry } from "@/app/(platform)/procurement/opportunities/discover/actions";

/** Dense paste form — operator supplies title (required) and optional URL/fields. */
export function ManualPublicEntryForm() {
  return (
    <details className="rounded-md border p-2">
      <summary className="cursor-pointer text-sm font-medium">
        Manual public notice entry
      </summary>
      <p className="mt-1 text-xs text-muted-foreground">
        Paste a notice you found outside configured providers. Fields are stored exactly as entered —
        nothing is searched or inferred.
      </p>
      <form action={submitManualPublicEntry} className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Title *</span>
          <Input name="title" required className="h-8 w-64" placeholder="Solicitation title" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Source URL</span>
          <Input name="source_url" className="h-8 w-64" placeholder="https://…" />
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
          <Input name="geography" className="h-8 w-36" />
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
