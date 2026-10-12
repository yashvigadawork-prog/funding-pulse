"use client";

import { createContext, useContext, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/lib/client/api";
import { CoverageContent } from "@/components/coverage/coverage-sidebar";

interface ShellContext {
  openCoverage: () => void;
}
const Ctx = createContext<ShellContext>({ openCoverage: () => {} });
export const useShell = () => useContext(Ctx);

/** Page frame: a sticky translucent header, the content, and My Coverage as a slide-over drawer. */
export function AppShell({ header, footer, children }: { header: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode }) {
  const { data: config, error, mutate } = useConfig();
  const [open, setOpen] = useState(false);

  const body = config ? (
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
    <Ctx.Provider value={{ openCoverage: () => setOpen(true) }}>
      <div className="flex min-h-dvh flex-col">
        <header className="no-print sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/70">{header}</header>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
        {footer}
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" showCloseButton className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[46rem] data-[side=right]:sm:max-w-[46rem]">
          <SheetHeader className="sr-only">
            <SheetTitle>My Coverage</SheetTitle>
            <SheetDescription>Mandate, Portfolio, On Radar and settings</SheetDescription>
          </SheetHeader>
          {open ? body : null}
        </SheetContent>
      </Sheet>
    </Ctx.Provider>
  );
}
