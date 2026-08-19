"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV = [
  {
    label: "Overview",
    items: [{ href: "/overview", title: "Dashboard" }],
  },
  {
    label: "Ingestion",
    items: [
      { href: "/ingestion/intake", title: "Document Intake" },
      { href: "/ingestion/processing", title: "Processing Queue" },
      { href: "/ingestion/verification", title: "Verification Queue" },
      { href: "/ingestion/exceptions", title: "Exceptions" },
    ],
  },
  {
    label: "Procurement",
    items: [
      { href: "/procurement/clients", title: "Clients" },
      { href: "/procurement/opportunities", title: "Opportunities" },
      { href: "/procurement/requirements", title: "Requirements" },
      { href: "/procurement/documents", title: "Documents" },
    ],
  },
  {
    label: "Contracts",
    items: [
      { href: "/contracts", title: "Contracts" },
      { href: "/contracts/renewals", title: "Renewals" },
      { href: "/contracts/compliance", title: "Compliance" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/intelligence/win-loss", title: "Win/Loss" },
      { href: "/intelligence/pricing", title: "Pricing" },
      { href: "/intelligence/clients", title: "Client Intelligence" },
      { href: "/intelligence/competitors", title: "Competitors" },
      { href: "/intelligence/content", title: "Content Library" },
      { href: "/intelligence/analytics", title: "Analytics" },
    ],
  },
  {
    label: "Proposals",
    items: [{ href: "/proposals", title: "Proposal Workspaces" }],
  },
  {
    label: "System",
    items: [
      { href: "/system/data-quality", title: "Data Quality" },
      { href: "/system/settings", title: "Settings" },
    ],
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-3 py-3 text-sm font-semibold">
        Contract Intelligence
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                    >
                      <Link href={item.href}>{item.title}</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
