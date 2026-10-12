"use client";

import Link from "next/link";
import { BookOpenText, FileDown, PanelLeftOpen, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useShell } from "@/components/app-shell";
import { NativeSelect } from "@/components/common/ui-bits";
import { RefreshButton, type useRefresh } from "@/components/dashboard/refresh";
import { useConfig } from "@/lib/client/api";
import { formatWeekRange } from "@/lib/time";

export function TopBar({
  weeks,
  week,
  onWeekChange,
  refresh,
}: {
  weeks?: { week: string }[];
  week?: string | null;
  onWeekChange?: (w: string) => void;
  refresh?: ReturnType<typeof useRefresh>;
}) {
  const { data } = useConfig();
  const { openCoverage } = useShell();

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.info(`Copy this link: ${url}`);
    }
  }

  return (
    <div className="mx-auto flex min-h-[var(--header-h)] w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
      <Button variant="outline" size="sm" className="lg:hidden" onClick={openCoverage}>
        <PanelLeftOpen data-icon="inline-start" /> My Coverage
      </Button>
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-sm font-semibold tracking-tight">{data?.fund_profile.name ?? "Funding Pulse"}</p>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">
          Funding Pulse · {data ? `${data.fund_profile.type}, ${data.fund_profile.location}` : "Weekly Indian startup funding digest"}
        </p>
      </div>
      {weeks && weeks.length ? (
        <div className="w-44 sm:w-56">
          <NativeSelect
            ariaLabel="Choose a week"
            value={week ?? weeks[0].week}
            onChange={(v) => onWeekChange?.(v)}
            options={weeks.map((w, i) => ({ value: w.week, label: `${formatWeekRange(w.week)}${i === 0 ? " (latest)" : ""}` }))}
          />
        </div>
      ) : null}
      {refresh ? <RefreshButton r={refresh} compact /> : null}
      <Button variant="outline" size="icon" onClick={share} aria-label="Share: copy the link to this page">
        <Share2 />
      </Button>
      {week ? (
        <Button variant="outline" size="icon" aria-label="Download PDF" nativeButton={false} render={<a href={`/report/${week}?print=1`} target="_blank" rel="noopener noreferrer" />}>
          <FileDown />
        </Button>
      ) : null}
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/method" />}>
        <BookOpenText data-icon="inline-start" /> Method
      </Button>
      <ThemeToggle />
    </div>
  );
}
