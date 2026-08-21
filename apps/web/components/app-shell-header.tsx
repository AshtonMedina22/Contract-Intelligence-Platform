"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { crumbsForPath } from "@/lib/shell/nav";
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

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="min-w-0 flex-1">
        <Breadcrumb>
          <BreadcrumbList className="flex-nowrap text-xs sm:text-sm">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <span key={`${crumb.href}-${index}`} className="contents">
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem className="min-w-0">
                    {isLast ? (
                      <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href} className="truncate">
                          {crumb.label}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">
          {orgName ?? "No organization"}
        </p>
      </div>
      <form
        action="/intelligence/ask"
        method="get"
        className="flex min-w-0 max-w-[10rem] flex-1 items-center sm:max-w-xs"
      >
        <input type="hidden" name="mode" value="ask" />
        <input type="hidden" name="purpose" value="GENERAL_QA" />
        <Search className="mr-1 size-3.5 shrink-0 text-muted-foreground" />
        <Input
          name="q"
          placeholder="Find or Ask GPT..."
          className="h-8"
          aria-label="Find or Ask GPT"
        />
      </form>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            <Plus className="size-3.5" />
            New
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href="/ingestion/intake">New solicitation</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/procurement/opportunities/discover">Discover opportunities</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/ingestion/bulk">Import historical package</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/contracts">Add existing contract</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/intelligence/clients">Add research source</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <UserMenu email={email} />
    </div>
  );
}
