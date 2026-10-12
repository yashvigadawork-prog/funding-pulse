"use client";

import { createContext, useContext, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfig } from "@/lib/client/api";
import { CoverageContent } from "@/components/coverage/coverage-sidebar";

interface ShellContext {
  openCoverage: () => void;
}
const Ctx = createContext<ShellContext>({ openCoverage: () => {} });
export const useShell = () => useContext(Ctx);

export function AppShell({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const { data: config, error, mutate } = useConfig();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarBody = config ? (
    <CoverageContent config={config} onChanged={() => mutate()} />
  ) : error ? (
    <div className="p-4 text-sm" role="alert">
      <p className="font-medium text-destructive">Could not load your coverage list.</p>
      <p className="mt-1 text-muted-foreground">{error instanceof Error ? error.message : "Please refresh the page."}</p>
      <Button size="sm" variant="outline" className="mt-3" onClick={() => mutate()}>
        Try again
      </Button>
    </div>
  ) : (
    <div className="grid gap-3 p-4" aria-busy="true" aria-label="Loading coverage list">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );

  return (
    <Ctx.Provider value={{ openCoverage: () => setMobileOpen(true) }}>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75 no-print">{header}</header>
        <div className="flex flex-1">
          <aside
            aria-label="My Coverage"
            className={`no-print sticky top-[var(--header-h)] hidden h-[calc(100dvh-var(--header-h))] shrink-0 border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:block ${
              collapsed ? "w-12" : "w-[23rem]"
            }`}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-2 z-10"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand My Coverage" : "Collapse My Coverage"}
              aria-expanded={!collapsed}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
            <div className={collapsed ? "hidden" : "h-full"}>{sidebarBody}</div>
          </aside>
          <main id="main" className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showCloseButton className="w-[92vw] max-w-md gap-0 p-0 data-[side=left]:sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>My Coverage</SheetTitle>
            <SheetDescription>Mandate, Portfolio, On Radar and settings</SheetDescription>
          </SheetHeader>
          {mobileOpen ? sidebarBody : null}
        </SheetContent>
      </Sheet>
    </Ctx.Provider>
  );
}
