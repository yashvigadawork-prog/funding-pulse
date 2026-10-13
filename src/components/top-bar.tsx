"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { BookOpenText, FileDown, PanelRightOpen, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useShell } from "@/components/app-shell";
import { NativeSelect } from "@/components/common/ui-bits";
import { RefreshButton, type useRefresh } from "@/components/dashboard/refresh";
import { TABS, useNav } from "@/components/dashboard/nav";
import { DeckDialog } from "@/components/deck/deck-dialog";
import { useConfig } from "@/lib/client/api";
import { formatWeekRange } from "@/lib/time";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-[10px] bg-foreground text-background", className)}>
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h4l2.5-6 4 13 2.5-7H22" />
      </svg>
    </span>
  );
}

export function TopBar({
  weeks,
  defaultWeek,
  week,
  refresh,
  actionsCount,
}: {
  weeks?: { week: string }[];
  defaultWeek?: string | null;
  week?: string | null;
  refresh?: ReturnType<typeof useRefresh>;
  actionsCount?: number;
}) {
  const { data } = useConfig();
  const { openCoverage } = useShell();
  const nav = useNav();
  const [deckOpen, setDeckOpen] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      // Older or locked-down browsers: fall back to a hidden text box and the classic copy command.
      const box = document.createElement("textarea");
      box.value = url;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      const ok = document.execCommand("copy");
      box.remove();
      if (ok) toast.success("Link copied");
      else toast.info(`Copy this link: ${url}`);
    }
  }

  const weekPicker =
    weeks && weeks.length ? (
      <NativeSelect
        ariaLabel="Choose a week"
        value={week ?? weeks[0].week}
        onChange={(v) => nav.setWeek(v)}
        className="h-9 rounded-full bg-card pl-3 text-[13px]"
        options={weeks.map((w, i) => ({ value: w.week, label: `${formatWeekRange(w.week)}${w.week === defaultWeek ? " (latest digest)" : i === 0 ? " (in progress)" : ""}` }))}
      />
    ) : null;

  return (
    <div className="mx-auto w-full max-w-[88rem] px-4 md:px-6">
      <div className="flex min-h-14 items-center gap-3 py-2 md:min-h-16">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Funding Pulse, home">
          <BrandMark />
          <span className="min-w-0 leading-tight">
            <span className="display block truncate text-[22px]">Funding Pulse</span>
            <span className="hidden truncate text-[11px] text-muted-foreground sm:block">
              {data ? `${data.fund_profile.name} · ${data.fund_profile.location.split(",")[0]} ${data.fund_profile.type.toLowerCase()}` : "Weekly Indian startup funding digest"}
            </span>
          </span>
        </Link>

        <nav aria-label="Sections" className="ml-4 hidden items-center gap-0.5 rounded-full border bg-card p-1 md:flex">
          {TABS.map((t) => {
            const active = nav.tab === t.id;
            return (
              <Link
                key={t.id}
                href={nav.href(t.id)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-3.5 py-1.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active ? <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-foreground" transition={{ type: "spring", stiffness: 420, damping: 34 }} /> : null}
                <span className="relative inline-flex items-center gap-1.5">
                  {t.label}
                  {t.id === "actions" && actionsCount ? (
                    <span className={cn("fig grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px]", active ? "bg-background/20 text-background" : "bg-primary text-primary-foreground")}>{actionsCount}</span>
                  ) : null}
                </span>
              </Link>
            );
          })}
          <Link href="/method" className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            Method
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden w-60 lg:block">{weekPicker}</div>
          <Button variant="outline" size="sm" className="hidden h-9 rounded-full bg-card md:inline-flex" onClick={openCoverage}>
            <PanelRightOpen data-icon="inline-start" /> My Coverage
          </Button>
          <Button variant="outline" size="icon" className="size-9 rounded-full bg-card md:hidden" onClick={openCoverage} aria-label="My Coverage">
            <PanelRightOpen />
          </Button>
          {refresh ? <RefreshButton r={refresh} compact /> : null}
          <span className="hidden items-center gap-2 sm:flex">
            <Button variant="outline" size="icon" className="size-9 rounded-full bg-card" onClick={share} aria-label="Share: copy the link to this page">
              <Share2 />
            </Button>
            {week ? (
              <Button variant="outline" size="icon" className="size-9 rounded-full bg-card" aria-label="Download PDF" onClick={() => setDeckOpen(true)}>
                <FileDown />
              </Button>
            ) : null}
          </span>
          <ThemeToggle />
        </div>
      </div>
      {/* Phone: week picker and the smaller links get their own row, since the tabs move to the bottom bar. */}
      <div className="flex items-center gap-2 pb-2 lg:hidden">
        <div className="min-w-0 flex-1">{weekPicker}</div>
        <Button variant="outline" size="icon" className="size-9 rounded-full bg-card sm:hidden" onClick={share} aria-label="Share: copy the link to this page">
          <Share2 />
        </Button>
        {week ? (
          <Button variant="outline" size="icon" className="size-9 rounded-full bg-card sm:hidden" aria-label="Download PDF" onClick={() => setDeckOpen(true)}>
            <FileDown />
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="rounded-full md:hidden" nativeButton={false} render={<Link href="/method" />}>
          <BookOpenText data-icon="inline-start" /> Method
        </Button>
      </div>
      {week ? <DeckDialog week={week} open={deckOpen} onOpenChange={setDeckOpen} /> : null}
    </div>
  );
}
