"use client";

import { PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useShell } from "@/components/app-shell";
import { useConfig } from "@/lib/client/api";

export function TopBar() {
  const { data } = useConfig();
  const { openCoverage } = useShell();
  return (
    <div className="mx-auto flex h-[var(--header-h)] items-center gap-3 px-4">
      <Button variant="outline" size="sm" className="lg:hidden" onClick={openCoverage}>
        <PanelLeftOpen data-icon="inline-start" /> My Coverage
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight">{data?.fund_profile.name ?? "Funding Pulse"}</p>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">Funding Pulse · {data?.fund_profile.tagline ?? "Weekly Indian startup funding digest"}</p>
      </div>
      <ThemeToggle />
    </div>
  );
}
