import { permanentRedirect } from "next/navigation";

/**
 * `/intelligence/buyers` was a dead URL: the tab, the registry and the home snapshot all pointed at
 * it, but the buyer view has always lived at `/intelligence/clients` because the table is `clients`.
 * The canonical route stays `clients`; this keeps old links and bookmarks working.
 */
export default function IntelligenceBuyersRedirect() {
  permanentRedirect("/intelligence/clients");
}
