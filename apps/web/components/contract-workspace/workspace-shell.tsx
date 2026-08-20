"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { contractWorkspaceTabs } from "@/components/opportunity-workspace/shared";

export function ContractWorkspaceShell({
  contractId,
  title,
  clientName,
  contractNumber,
  children,
}: {
  contractId: string;
  title: string;
  clientName: string | null;
  contractNumber: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tabs = contractWorkspaceTabs(contractId);

  return (
    <div className="space-y-4">
      <div className="space-y-1 border-b pb-4">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {clientName ?? "No buyer linked"}
          {contractNumber ? ` · ${contractNumber}` : ""}
        </p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b pb-2 text-sm" aria-label="Contract workspace">
        {tabs.map((tab) => {
          const base = tabs[0].href;
          const active =
            tab.href === base ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground",
                active && "bg-muted font-medium text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
