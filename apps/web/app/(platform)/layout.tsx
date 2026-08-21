import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppShellHeader } from "@/components/app-shell-header";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getIntakeContext } from "@/lib/org/intake-context";

async function HeaderSlot() {
  const { user, organizations } = await getIntakeContext();
  return (
    <AppShellHeader
      orgName={organizations[0]?.name ?? null}
      email={user?.email ?? null}
    />
  );
}

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Suspense fallback={<div className="bg-sidebar w-[15.5rem] shrink-0 border-r" />}>
        <AppSidebar />
      </Suspense>
      <SidebarInset>
        <header className="flex min-h-12 shrink-0 items-center gap-2 border-b px-2 py-1.5">
          {/* Outside the sheet so mobile (<768) can open primary nav */}
          <SidebarTrigger className="md:hidden" />
          <Suspense fallback={<div className="h-8 flex-1" />}>
            <HeaderSlot />
          </Suspense>
        </header>
        <div className="min-w-0 flex-1 p-3 md:p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
