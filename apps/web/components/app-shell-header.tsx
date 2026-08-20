"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
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
  const action = primaryActionForPath(pathname);

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
        className="hidden min-w-0 max-w-xs flex-1 items-center lg:flex"
      >
        <Search className="mr-1 size-3.5 shrink-0 text-muted-foreground" />
        <Input
          name="q"
          placeholder="Search verified knowledge…"
          className="h-8"
          aria-label="Search verified knowledge"
        />
      </form>
      <Button asChild size="sm" variant={pathname === "/overview" ? "default" : "outline"}>
        <Link href={action.href}>{action.label}</Link>
      </Button>
      <UserMenu email={email} />
    </div>
  );
}
