export type Crumb = { href: string; label: string };

const TITLES: { prefix: string; label: string }[] = [
  { prefix: "/overview", label: "Home" },
  { prefix: "/ingestion/intake", label: "New proposal / Intake" },
  { prefix: "/ingestion/bulk", label: "Bulk migration" },
  { prefix: "/ingestion/processing", label: "Processing" },
  { prefix: "/ingestion/verification", label: "Verification" },
  { prefix: "/ingestion/exceptions", label: "Exceptions" },
  { prefix: "/procurement/opportunities", label: "Opportunities" },
  { prefix: "/procurement/documents", label: "Historical library" },
  { prefix: "/procurement/clients", label: "Clients" },
  { prefix: "/procurement/requirements", label: "Requirements" },
  { prefix: "/contracts/renewals", label: "Renewals" },
  { prefix: "/contracts/compliance", label: "Compliance" },
  { prefix: "/contracts", label: "Contracts & compliance" },
  { prefix: "/intelligence/ask", label: "Ask Intelligence" },
  { prefix: "/intelligence/market", label: "Market & Competitors" },
  { prefix: "/intelligence/reports", label: "Reports" },
  { prefix: "/intelligence/pricing", label: "Pricing intelligence" },
  { prefix: "/intelligence/win-loss", label: "Win/Loss" },
  { prefix: "/intelligence/clients", label: "Buyers / research" },
  { prefix: "/intelligence/competitors", label: "Competitors" },
  { prefix: "/intelligence/content", label: "Content intelligence" },
  { prefix: "/intelligence/analytics", label: "Reports" },
  { prefix: "/intelligence", label: "Intelligence" },
  { prefix: "/proposals", label: "Proposal workspaces" },
  { prefix: "/system/data-quality", label: "Data quality" },
  { prefix: "/system/settings", label: "Settings" },
];

export function crumbsForPath(pathname: string): Crumb[] {
  const match = TITLES.find((row) => pathname === row.prefix || pathname.startsWith(`${row.prefix}/`));
  if (!match) return [{ href: pathname, label: "Workspace" }];
  if (match.prefix === "/overview") return [{ href: "/overview", label: "Home" }];
  return [
    { href: "/overview", label: "L&P" },
    { href: match.prefix, label: match.label },
  ];
}

export function primaryActionForPath(pathname: string): { href: string; label: string } {
  if (pathname.startsWith("/ingestion/verification")) {
    return { href: "/ingestion/verification", label: "Open queue" };
  }
  if (pathname.startsWith("/proposals")) {
    return { href: "/ingestion/intake", label: "Analyze solicitation" };
  }
  return { href: "/ingestion/intake", label: "Analyze solicitation" };
}
