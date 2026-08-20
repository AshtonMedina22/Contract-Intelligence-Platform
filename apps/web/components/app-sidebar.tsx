"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  ChevronDown,
  FileStack,
  FolderOpen,
  LayoutDashboard,
  LineChart,
  PenLine,
  Scale,
  Settings,
  ShieldCheck,
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

const PROPOSALS = [
  { href: "/ingestion/intake", title: "New solicitation" },
  { href: "/proposals", title: "Workspaces" },
] as const;

const INTELLIGENCE = [
  { href: "/intelligence/ask", title: "Ask Intelligence" },
  { href: "/intelligence/market", title: "Market & Competitors" },
  { href: "/intelligence/pricing", title: "Pricing" },
  { href: "/intelligence/win-loss", title: "Win/Loss" },
  { href: "/intelligence/content", title: "Content" },
  { href: "/intelligence/reports", title: "Reports" },
] as const;

const LIBRARY = [
  { href: "/procurement/documents", title: "Packages & documents" },
  { href: "/ingestion/intake", title: "Intake" },
  { href: "/ingestion/verification", title: "Verification" },
] as const;

const CONTRACTS = [
  { href: "/contracts", title: "Portfolio" },
  { href: "/contracts/renewals", title: "Renewals" },
  { href: "/contracts/compliance", title: "Compliance" },
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
  const proposalsActive =
    pathname.startsWith("/proposals") || pathname.startsWith("/ingestion/intake");
  const intelActive = pathname.startsWith("/intelligence");
  const libraryActive =
    pathname.startsWith("/procurement/documents") ||
    pathname.startsWith("/ingestion/");
  const contractsActive = pathname.startsWith("/contracts");

  const [proposalsOpen, setProposalsOpen] = useOpenSection(proposalsActive);
  const [intelOpen, setIntelOpen] = useOpenSection(intelActive);
  const [libraryOpen, setLibraryOpen] = useOpenSection(libraryActive);
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
                title="Proposals"
                icon={PenLine}
                tooltip="Proposals"
                active={proposalsActive}
                open={proposalsOpen}
                onToggle={() => setProposalsOpen((v) => !v)}
              >
                {PROPOSALS.map((sub) => (
                  <SidebarMenuSubItem key={`p-${sub.href}`}>
                    <SidebarMenuSubButton asChild size="sm" isActive={pathActive(pathname, sub.href)}>
                      <Link href={sub.href}>{sub.title}</Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </ExpandableSection>

              <ExpandableSection
                title="Intelligence"
                icon={LineChart}
                tooltip="Intelligence"
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

              <ExpandableSection
                title="Historical library"
                icon={FileStack}
                tooltip="Historical library"
                active={libraryActive}
                open={libraryOpen}
                onToggle={() => setLibraryOpen((v) => !v)}
              >
                {LIBRARY.map((sub) => (
                  <SidebarMenuSubItem key={`l-${sub.href}`}>
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
