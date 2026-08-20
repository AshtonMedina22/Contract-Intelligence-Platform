"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { crumbsForPath, primaryActionForPath } from "@/lib/shell/nav";
import { UserMenu } from "@/components/user-menu";

export function AppShellHeader({
  orgName,
  email,
}: {
  orgName: string | null;
  email: string | null;
}) {
  const pathname = usePathname();
  const crumbs = crumbsForPath(pathname);
  const page = crumbs[crumbs.length - 1];
  const action = primaryActionForPath(pathname);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{page?.label ?? "Workspace"}</p>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">
          {orgName ?? "No organization"}
        </p>
      </div>
      <form
        action="/intelligence/ask"
        method="get"
        className="ml-auto hidden min-w-0 max-w-xs flex-1 items-center md:flex"
      >
        <Search className="mr-1 size-3.5 shrink-0 text-muted-foreground" />
        <Input
          name="q"
          placeholder="Search or ask L&P Intelligence…"
          className="h-8"
          aria-label="Search or ask L&P Intelligence"
        />
      </form>
      <Button asChild size="sm">
        <Link href={action.href}>{action.label}</Link>
      </Button>
      <UserMenu email={email} />
    </div>
  );
}
