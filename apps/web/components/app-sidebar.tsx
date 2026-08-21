"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Database,
  FolderOpen,
  LayoutDashboard,
  LineChart,
  Scale,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";

function pathActive(pathname: string, href: string) {
  if (href === "/overview") return pathname === "/overview";
  if (href === "/contracts") {
    return pathname === "/contracts" || pathname.startsWith("/contracts/");
  }
  if (href === "/procurement/opportunities") {
    return pathname.startsWith("/procurement/opportunities") || pathname.startsWith("/proposals");
  }
  if (href === "/intelligence") {
    return pathname.startsWith("/intelligence") && !pathname.startsWith("/intelligence/ask");
  }
  if (href === "/ingestion/intake") {
    return pathname.startsWith("/ingestion");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-2 py-2">
        <div className="flex items-center gap-1">
          <SidebarTrigger />
          <SidebarMenu className="flex-1">
            <SidebarMenuItem>
              <SidebarMenuButton size="sm" asChild tooltip="L&P Procurement Intelligence">
                <Link href="/overview">
                  <FolderOpen />
                  <span className="font-semibold">L&P</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  isActive={pathname === "/overview"}
                  tooltip="Home"
                >
                  <Link href="/overview">
                    <LayoutDashboard />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  isActive={pathActive(pathname, "/procurement/opportunities")}
                  tooltip="Pursuits"
                >
                  <Link href="/procurement/opportunities">
                    <Briefcase />
                    <span>Pursuits</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  isActive={pathActive(pathname, "/intelligence")}
                  tooltip="Intelligence"
                >
                  <Link href="/intelligence">
                    <LineChart />
                    <span>Intelligence</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  isActive={pathActive(pathname, "/contracts")}
                  tooltip="Contracts"
                >
                  <Link href="/contracts">
                    <Scale />
                    <span>Contracts</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  isActive={pathActive(pathname, "/ingestion/intake")}
                  tooltip="Data Ops"
                >
                  <Link href="/ingestion/intake">
                    <Database />
                    <span>Data Ops</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="sm"
              isActive={pathname.startsWith("/system")}
              tooltip="Settings"
            >
              <Link href="/system/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
