export type Crumb = { href: string; label: string };

type Section = { label: string; href: string };

const SECTIONS: { prefix: string; section: Section }[] = [
  { prefix: "/ingestion", section: { label: "Data Ops", href: "/ingestion/intake" } },
  { prefix: "/procurement/opportunities", section: { label: "Pursuits", href: "/procurement/opportunities" } },
  { prefix: "/procurement/documents", section: { label: "Data Ops", href: "/ingestion/intake" } },
  { prefix: "/procurement/clients", section: { label: "Intelligence", href: "/intelligence/clients" } },
  { prefix: "/procurement/requirements", section: { label: "Pursuits", href: "/procurement/opportunities" } },
  { prefix: "/procurement", section: { label: "Pursuits", href: "/procurement/opportunities" } },
  { prefix: "/contracts", section: { label: "Contracts", href: "/contracts" } },
  { prefix: "/intelligence", section: { label: "Intelligence", href: "/intelligence/market" } },
  { prefix: "/proposals", section: { label: "Pursuits", href: "/procurement/opportunities" } },
  { prefix: "/system", section: { label: "Settings", href: "/system/settings" } },
];

/** Longest-prefix page titles within each area. */
const PAGE_TITLES: { prefix: string; label: string }[] = [
  { prefix: "/overview", label: "Home" },
  { prefix: "/ingestion/intake", label: "Intake" },
  { prefix: "/ingestion/processing", label: "Processing" },
  { prefix: "/ingestion/verification/", label: "Verification workbench" },
  { prefix: "/ingestion/verification", label: "Verification" },
  { prefix: "/ingestion/exceptions", label: "Exceptions" },
  { prefix: "/ingestion/bulk", label: "Historical Migration" },
  { prefix: "/procurement/documents", label: "Documents" },
  { prefix: "/procurement/opportunities", label: "Pursuits" },
  { prefix: "/procurement/clients", label: "Buyers" },
  { prefix: "/procurement/requirements", label: "Requirements" },
  { prefix: "/contracts/renewals", label: "Renewal queue" },
  { prefix: "/contracts/compliance", label: "Compliance" },
  { prefix: "/contracts/", label: "Contract" },
  { prefix: "/contracts", label: "Portfolio" },
  { prefix: "/intelligence/ask", label: "Find or Ask GPT" },
  { prefix: "/intelligence/market", label: "Market" },
  { prefix: "/intelligence/competitors", label: "Competitors" },
  { prefix: "/intelligence/clients", label: "Buyers" },
  { prefix: "/intelligence/pricing", label: "Pricing" },
  { prefix: "/intelligence/win-loss", label: "Win/Loss" },
  { prefix: "/intelligence/content", label: "Content" },
  { prefix: "/intelligence/reports", label: "Reports" },
  { prefix: "/intelligence/analytics", label: "Reports" },
  { prefix: "/intelligence", label: "Intelligence" },
  { prefix: "/proposals", label: "Pursuits" },
  { prefix: "/system/data-model", label: "Data model" },
  { prefix: "/system/data-quality", label: "Data quality" },
  { prefix: "/system/settings", label: "Settings" },
];

const PURSUIT_TAB_LABELS: Record<string, string> = {
  requirements: "Requirements",
  staffing: "Requirements",
  pricing: "Pricing",
  documents: "Submission",
  submission: "Submission",
  response: "Response",
  intelligence: "Result",
  result: "Result",
  contract: "Result",
};

function findPage(pathname: string) {
  const workspaceTab = pathname.match(
    /^\/procurement\/opportunities\/[^/]+\/(requirements|staffing|pricing|documents|submission|response|intelligence|result|contract)$/,
  );
  if (workspaceTab) {
    return { prefix: pathname, label: PURSUIT_TAB_LABELS[workspaceTab[1]!] ?? "Workspace" };
  }
  if (/^\/procurement\/opportunities\/[^/]+$/.test(pathname)) {
    return { prefix: pathname, label: "Overview" };
  }

  const contractTab = pathname.match(
    /^\/contracts\/[^/]+\/(service-plan|commercial-terms|changes|renewal)$/,
  );
  if (contractTab) {
    const labels: Record<string, string> = {
      "service-plan": "Service Plan",
      "commercial-terms": "Commercial Terms",
      changes: "Changes",
      renewal: "Renewal",
    };
    return { prefix: pathname, label: labels[contractTab[1]!] ?? "Contract" };
  }
  if (/^\/contracts\/[^/]+$/.test(pathname)) {
    return { prefix: pathname, label: "Overview" };
  }

  return PAGE_TITLES.find((row) => pathname === row.prefix || pathname.startsWith(`${row.prefix}`));
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
    const isDuplicate = crumbs.length > 0 && crumbs[crumbs.length - 1]?.label === page.label;
    if (!isSectionHome && !isDuplicate) {
      crumbs.push({ href: pageHref, label: page.label });
    }
  }

  if (crumbs.length === 1) {
    crumbs.push({ href: pathname, label: "Workspace" });
  }

  return crumbs;
}
