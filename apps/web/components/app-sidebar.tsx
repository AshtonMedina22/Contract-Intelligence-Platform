"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  Briefcase,
  ChevronDown,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const INTELLIGENCE = [
  { href: "/intelligence/clients", title: "Buyers" },
  { href: "/intelligence/competitors", title: "Competitors" },
  { href: "/intelligence/market", title: "Market" },
  { href: "/intelligence/pricing", title: "Pricing" },
  { href: "/intelligence/win-loss", title: "Win/Loss" },
  { href: "/intelligence/content", title: "Content" },
  { href: "/intelligence/reports", title: "Reports" },
] as const;

const DATA_OPS = [
  { href: "/ingestion/intake", title: "Intake" },
  { href: "/ingestion/processing", title: "Processing" },
  { href: "/ingestion/verification", title: "Verification" },
  { href: "/ingestion/exceptions", title: "Exceptions" },
  { href: "/ingestion/bulk", title: "Historical Migration" },
] as const;

function pathActive(pathname: string, href: string) {
  if (href === "/overview") return pathname === "/overview";
  if (href === "/contracts") {
    return pathname === "/contracts" || pathname.startsWith("/contracts/");
  }
  if (href === "/procurement/opportunities") {
    return pathname.startsWith("/procurement/opportunities") || pathname.startsWith("/proposals");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function useOpenSection(active: boolean) {
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  return [open, setOpen] as const;
}

function ExpandableSection({
  title,
  icon: Icon,
  tooltip,
  active,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  tooltip: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton size="sm" tooltip={tooltip} isActive={active} onClick={onToggle}>
        <Icon />
        <span>{title}</span>
        <ChevronDown className={`ml-auto size-3 transition ${open ? "rotate-0" : "-rotate-90"}`} />
      </SidebarMenuButton>
      {open ? <SidebarMenuSub>{children}</SidebarMenuSub> : null}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const intelActive =
    pathname.startsWith("/intelligence") && !pathname.startsWith("/intelligence/ask");
  const dataOpsActive = pathname.startsWith("/ingestion/");
  const [intelOpen, setIntelOpen] = useOpenSection(intelActive);
  const [dataOpsOpen, setDataOpsOpen] = useOpenSection(dataOpsActive);

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

              <ExpandableSection
                title="Intelligence"
                icon={LineChart}
                tooltip="Cross-corpus analysis"
                active={intelActive || pathname.startsWith("/intelligence")}
                open={intelOpen}
                onToggle={() => setIntelOpen((v) => !v)}
              >
                {INTELLIGENCE.map((sub) => (
                  <SidebarMenuSubItem key={sub.href}>
                    <SidebarMenuSubButton asChild size="sm" isActive={pathActive(pathname, sub.href)}>
                      <Link href={sub.href}>{sub.title}</Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </ExpandableSection>

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

              <ExpandableSection
                title="Data Ops"
                icon={Database}
                tooltip="Trusted data workflow"
                active={dataOpsActive}
                open={dataOpsOpen}
                onToggle={() => setDataOpsOpen((v) => !v)}
              >
                {DATA_OPS.map((sub) => (
                  <SidebarMenuSubItem key={sub.href}>
                    <SidebarMenuSubButton asChild size="sm" isActive={pathActive(pathname, sub.href)}>
                      <Link href={sub.href}>{sub.title}</Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </ExpandableSection>
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
