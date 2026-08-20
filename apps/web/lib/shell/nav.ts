export type Crumb = { href: string; label: string };

type Section = { label: string; href: string };

const SECTIONS: { prefix: string; section: Section }[] = [
  { prefix: "/ingestion", section: { label: "Ingestion", href: "/ingestion/intake" } },
  { prefix: "/procurement", section: { label: "Procurement", href: "/procurement/documents" } },
  { prefix: "/contracts", section: { label: "Contracts", href: "/contracts" } },
  { prefix: "/intelligence", section: { label: "Intelligence", href: "/intelligence/ask" } },
  { prefix: "/proposals", section: { label: "Proposals", href: "/proposals" } },
  { prefix: "/system", section: { label: "System", href: "/system/settings" } },
];

/** Longest-prefix page titles within each area. */
const PAGE_TITLES: { prefix: string; label: string }[] = [
  { prefix: "/overview", label: "Home" },
  { prefix: "/ingestion/intake", label: "Intake" },
  { prefix: "/ingestion/processing", label: "Processing" },
  { prefix: "/ingestion/verification/", label: "Verification workbench" },
  { prefix: "/ingestion/verification", label: "Verification" },
  { prefix: "/ingestion/exceptions", label: "Exceptions" },
  { prefix: "/ingestion/bulk", label: "Bulk migration" },
  { prefix: "/procurement/documents", label: "Documents" },
  { prefix: "/procurement/opportunities", label: "Opportunities" },
  { prefix: "/procurement/clients", label: "Clients" },
  { prefix: "/procurement/requirements", label: "Requirements" },
  { prefix: "/contracts/renewals", label: "Renewals" },
  { prefix: "/contracts/compliance", label: "Compliance" },
  { prefix: "/contracts/", label: "Contract" },
  { prefix: "/contracts", label: "Portfolio" },
  { prefix: "/intelligence/ask", label: "Ask Intelligence" },
  { prefix: "/intelligence/market", label: "Market" },
  { prefix: "/intelligence/competitors", label: "Competitors" },
  { prefix: "/intelligence/clients", label: "Buyers & research" },
  { prefix: "/intelligence/pricing", label: "Pricing" },
  { prefix: "/intelligence/win-loss", label: "Win/Loss" },
  { prefix: "/intelligence/content", label: "Content" },
  { prefix: "/intelligence/reports", label: "Reports" },
  { prefix: "/intelligence/analytics", label: "Reports" },
  { prefix: "/intelligence", label: "Intelligence" },
  { prefix: "/proposals", label: "Workspaces" },
  { prefix: "/system/data-model", label: "Data model" },
  { prefix: "/system/data-quality", label: "Data quality" },
  { prefix: "/system/settings", label: "Settings" },
];

function findPage(pathname: string) {
  const workspaceTab = pathname.match(
    /^\/procurement\/opportunities\/[^/]+\/(requirements|pricing|documents|intelligence|contract)$/,
  );
  if (workspaceTab) {
    const labels: Record<string, string> = {
      requirements: "Requirements",
      pricing: "Pricing",
      documents: "Documents",
      intelligence: "Competitors & outcome",
      contract: "Contract",
    };
    return { prefix: pathname, label: labels[workspaceTab[1]!] ?? "Workspace" };
  }
  if (/^\/procurement\/opportunities\/[^/]+$/.test(pathname)) {
    return { prefix: pathname, label: "Overview" };
  }
  return PAGE_TITLES.find(
    (row) => pathname === row.prefix || pathname.startsWith(`${row.prefix}`),
  );
}

function findSection(pathname: string): Section | null {
  const hit = SECTIONS.find((row) => pathname.startsWith(row.prefix));
  return hit?.section ?? null;
}

export function crumbsForPath(pathname: string): Crumb[] {
  if (pathname === "/overview") {
    return [{ href: "/overview", label: "Home" }];
  }

  const crumbs: Crumb[] = [{ href: "/overview", label: "Home" }];
  const section = findSection(pathname);
  const page = findPage(pathname);

  if (section) {
    crumbs.push({ href: section.href, label: section.label });
  }

  if (page) {
    const pageHref =
      page.prefix.endsWith("/") && pathname.startsWith(page.prefix)
        ? pathname
        : page.prefix.replace(/\/$/, "") || page.prefix;
    const isSectionHome = section && pageHref === section.href;
    const isDuplicate =
      crumbs.length > 0 && crumbs[crumbs.length - 1]?.label === page.label;
    if (!isSectionHome && !isDuplicate) {
      crumbs.push({ href: pageHref, label: page.label });
    }
  }

  if (crumbs.length === 1) {
    crumbs.push({ href: pathname, label: "Workspace" });
  }

  return crumbs;
}

export function primaryActionForPath(pathname: string): { href: string; label: string } {
  if (pathname === "/overview") {
    return { href: "/ingestion/intake", label: "Start intake" };
  }
  if (pathname.startsWith("/ingestion/intake")) {
    return { href: "/ingestion/processing", label: "View processing" };
  }
  if (pathname.startsWith("/ingestion/processing")) {
    return { href: "/ingestion/verification", label: "Open verification" };
  }
  if (pathname.startsWith("/ingestion/verification/")) {
    return { href: "/ingestion/verification", label: "Back to queue" };
  }
  if (pathname.startsWith("/ingestion/verification")) {
    return { href: "/ingestion/intake", label: "Add documents" };
  }
  if (pathname.startsWith("/procurement/opportunities/")) {
    return { href: `/ingestion/intake?opportunity=${pathname.split("/")[3] ?? ""}`, label: "Add documents" };
  }
  if (pathname.startsWith("/procurement/opportunities")) {
    return { href: "/ingestion/intake", label: "Analyze solicitation" };
  }
  if (pathname.startsWith("/proposals")) {
    return { href: "/ingestion/intake", label: "Analyze solicitation" };
  }
  if (pathname.startsWith("/contracts/") && pathname !== "/contracts/renewals" && pathname !== "/contracts/compliance") {
    return { href: "/contracts", label: "All contracts" };
  }
  if (pathname.startsWith("/intelligence")) {
    return { href: "/ingestion/intake", label: "Analyze solicitation" };
  }
  if (pathname.startsWith("/procurement")) {
    return { href: "/ingestion/intake", label: "Analyze solicitation" };
  }
  return { href: "/ingestion/intake", label: "Analyze solicitation" };
}
