"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  Briefcase,
  ChevronDown,
  FolderOpen,
  LayoutDashboard,
  LineChart,
  PenLine,
  Scale,
  Settings,
  ShieldCheck,
  Upload,
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

const INGESTION = [
  { href: "/ingestion/intake", title: "Intake" },
  { href: "/ingestion/processing", title: "Processing" },
  { href: "/ingestion/verification", title: "Verification" },
  { href: "/ingestion/exceptions", title: "Exceptions" },
  { href: "/ingestion/bulk", title: "Bulk migration" },
] as const;

const PROCUREMENT = [
  { href: "/procurement/documents", title: "Documents" },
  { href: "/procurement/opportunities", title: "Opportunities" },
  { href: "/procurement/clients", title: "Clients" },
  { href: "/procurement/requirements", title: "Requirements" },
] as const;

const CONTRACTS = [
  { href: "/contracts", title: "Portfolio" },
  { href: "/contracts/renewals", title: "Renewals" },
  { href: "/contracts/compliance", title: "Compliance" },
] as const;

const INTELLIGENCE = [
  { href: "/intelligence/ask", title: "Ask Intelligence" },
  { href: "/intelligence/market", title: "Market" },
  { href: "/intelligence/pricing", title: "Pricing" },
  { href: "/intelligence/win-loss", title: "Win/Loss" },
  { href: "/intelligence/content", title: "Content" },
  { href: "/intelligence/reports", title: "Reports" },
] as const;

function pathActive(pathname: string, href: string) {
  if (href === "/overview") return pathname === "/overview";
  if (href === "/contracts") return pathname === "/contracts";
  if (href === "/ingestion/intake") {
    return pathname === "/ingestion/intake" || pathname.startsWith("/ingestion/intake/");
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
  const ingestionActive = pathname.startsWith("/ingestion/");
  const procurementActive = pathname.startsWith("/procurement/");
  const intelActive = pathname.startsWith("/intelligence");
  const contractsActive = pathname.startsWith("/contracts");
  const proposalsActive = pathname.startsWith("/proposals");
  const [ingestionOpen, setIngestionOpen] = useOpenSection(ingestionActive);
  const [procurementOpen, setProcurementOpen] = useOpenSection(procurementActive);
  const [intelOpen, setIntelOpen] = useOpenSection(intelActive);
  const [contractsOpen, setContractsOpen] = useOpenSection(contractsActive);

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

              <ExpandableSection
                title="Ingestion"
                icon={Upload}
                tooltip="Document ingestion pipeline"
                active={ingestionActive}
                open={ingestionOpen}
                onToggle={() => setIngestionOpen((v) => !v)}
              >
                {INGESTION.map((sub) => (
                  <SidebarMenuSubItem key={sub.href}>
                    <SidebarMenuSubButton asChild size="sm" isActive={pathActive(pathname, sub.href)}>
                      <Link href={sub.href}>{sub.title}</Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </ExpandableSection>

              <ExpandableSection
                title="Procurement"
                icon={Briefcase}
                tooltip="Packages, opportunities, requirements"
                active={procurementActive}
                open={procurementOpen}
                onToggle={() => setProcurementOpen((v) => !v)}
              >
                {PROCUREMENT.map((sub) => (
                  <SidebarMenuSubItem key={sub.href}>
                    <SidebarMenuSubButton asChild size="sm" isActive={pathActive(pathname, sub.href)}>
                      <Link href={sub.href}>{sub.title}</Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </ExpandableSection>

              <ExpandableSection
                title="Contracts"
                icon={Scale}
                tooltip="Contracts & compliance"
                active={contractsActive}
                open={contractsOpen}
                onToggle={() => setContractsOpen((v) => !v)}
              >
                {CONTRACTS.map((sub) => (
                  <SidebarMenuSubItem key={sub.href}>
                    <SidebarMenuSubButton asChild size="sm" isActive={pathActive(pathname, sub.href)}>
                      <Link href={sub.href}>{sub.title}</Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </ExpandableSection>

              <ExpandableSection
                title="Intelligence"
                icon={LineChart}
                tooltip="Search and analyze verified corpus"
                active={intelActive}
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
                  isActive={proposalsActive}
                  tooltip="Proposal workspaces (Phase 13)"
                >
                  <Link href="/proposals">
                    <PenLine />
                    <span>Proposals</span>
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
              isActive={pathname.startsWith("/system/data-quality")}
              tooltip="Data quality"
            >
              <Link href="/system/data-quality">
                <ShieldCheck />
                <span>Data quality</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="sm"
              isActive={pathname.startsWith("/system/settings")}
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
