"use client";

import { createContext, useContext } from "react";
import { motion, type MotionProps, type TargetAndTransition, type Transition } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/client/hooks";
import { formatUsd } from "@/lib/money";
import { SECTOR_VAR } from "@/components/common/ui-bits";
import { cn } from "@/lib/utils";
import type { NewInvestorEntry, SectorCapital, SectorTrend } from "@/lib/pipeline/compute";

export const shortSector = (s: string) =>
  ({ "Health & wellness": "Health", "Climate & sustainability": "Climate", "Media, deeptech & education": "Media, deeptech, edu" })[s] ?? s;

const sectorColor = (s: string) => SECTOR_VAR[s] ?? "var(--sector-other)";
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** The print report switches animation off so charts are complete when the page is printed. */
const StaticChartsContext = createContext(false);
export function StaticCharts({ children }: { children: React.ReactNode }) {
  return <StaticChartsContext.Provider value>{children}</StaticChartsContext.Provider>;
}
/** True when charts should animate in (not reduced motion, not the print report). */
function useAnimate() {
  const reduced = usePrefersReducedMotion();
  const isStatic = useContext(StaticChartsContext);
  return !reduced && !isStatic;
}

/** Animation props that play once, when the chart scrolls into view. */
function inView(animate: boolean, from: TargetAndTransition, to: TargetAndTransition, transition: Transition): MotionProps {
  return animate
    ? { initial: from, whileInView: to, viewport: { once: true, margin: "0px 0px -8% 0px" }, transition }
    : { initial: false, animate: to };
}

/* ------------------------------------------------------------------ */
/* Where the money went                                                */
/* ------------------------------------------------------------------ */

/** Disclosed capital per sector this week, with a thin tick for the sector's usual weekly amount. */
export function MoneyChart({ capital, undisclosedCount }: { capital: SectorCapital[]; undisclosedCount?: number }) {
  const animate = useAnimate();
  const rows = capital
    .filter((c) => c.deals > 0 || c.baselineAvgUsd > 0)
    .map((c) => ({ sector: c.sector, usd: c.disclosedUsd, base: c.baselineAvgUsd, deals: c.deals, undisclosed: c.undisclosed.length }))
    .sort((a, b) => b.usd - a.usd);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.usd, r.base)));
  const summary = rows.length
    ? `Disclosed capital this week by sector: ${rows.map((r) => `${r.sector} ${r.usd ? formatUsd(r.usd) : "none disclosed"} across ${r.deals} deals, against a usual week of ${formatUsd(r.base)}`).join("; ")}.`
    : "No deals this week.";
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">No deals this week.</p>;
  return (
    <figure aria-label="Disclosed capital by sector" className="m-0">
      <p className="sr-only">{summary}</p>
      <ul aria-hidden className="grid gap-3">
        {rows.map((r, i) => {
          const w = (r.usd / max) * 100;
          const t = (r.base / max) * 100;
          return (
            <li key={r.sector} className="grid grid-cols-[6.75rem_1fr] items-center gap-3 md:grid-cols-[8.5rem_1fr]">
              <span className="flex items-center gap-1.5 text-[13px]">
                <span className="size-2 shrink-0 rounded-full" style={{ background: sectorColor(r.sector) }} />
                <span className="truncate">{shortSector(r.sector)}</span>
              </span>
              <div className="flex items-center gap-2.5">
                <div className="relative h-5 flex-1 rounded-md bg-muted/70">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-md"
                    style={{ background: sectorColor(r.sector) }}
                    {...inView(animate, { width: 0 }, { width: `${w}%` }, { duration: 0.7, delay: i * 0.06, ease: EASE_OUT })}
                  />
                  {r.base > 0 ? (
                    <motion.span
                      className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground"
                      style={{ left: `${t}%` }}
                      {...inView(animate, { opacity: 0, y: -10 }, { opacity: 1, y: 0 }, { type: "spring", stiffness: 380, damping: 18, delay: 0.5 + rows.length * 0.06 })}
                    />
                  ) : null}
                </div>
                <motion.span
                  className="fig w-[8.5rem] shrink-0 text-right text-xs"
                  {...inView(animate, { opacity: 0 }, { opacity: 1 }, { duration: 0.4, delay: 0.4 + i * 0.06 })}
                >
                  <span className="font-medium">{r.usd ? formatUsd(r.usd) : "none"}</span>
                  <span className="text-muted-foreground"> · {r.deals} {r.deals === 1 ? "deal" : "deals"}</span>
                </motion.span>
              </div>
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-0.5 rounded-full bg-foreground" /> tick = usual week
        </span>
        {undisclosedCount ? <span>{undisclosedCount} deals with an undisclosed amount are not counted.</span> : null}
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Who's heating up                                                    */
/* ------------------------------------------------------------------ */

const STATUS_WORD: Record<string, string> = { accelerating: "speeding up", slowing: "slowing", steady: "steady", not_enough_history: "too few deals to call" };

/** A dumbbell per sector: hollow dot = the four-week average, filled dot = this week, joined by a line. */
export function HeatChart({ trends, onlyFocus = true }: { trends: SectorTrend[]; onlyFocus?: boolean }) {
  const animate = useAnimate();
  const rows = trends.filter((t) => (onlyFocus ? t.isFocus : t.isFocus || t.thisWeek > 0 || t.baselineTotal > 0));
  const max = Math.max(1, ...rows.map((t) => Math.max(t.thisWeek, t.baselineAvg))) * 1.08;
  const summary = `Deals this week against the four-week average: ${rows.map((t) => `${t.sector} ${t.thisWeek} against ${Math.round(t.baselineAvg * 10) / 10}, ${STATUS_WORD[t.status]}`).join("; ")}.`;
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">No history yet.</p>;
  return (
    <figure aria-label="Deal counts against the four-week average" className="m-0">
      <p className="sr-only">{summary}</p>
      <ul aria-hidden className="grid gap-4">
        {rows.map((t, i) => {
          const a = (t.baselineAvg / max) * 100;
          const n = (t.thisWeek / max) * 100;
          const lo = Math.min(a, n);
          const hi = Math.max(a, n);
          const color = sectorColor(t.sector);
          const ratio = t.baselineAvg > 0 ? t.thisWeek / t.baselineAvg : null;
          const delay = i * 0.1;
          const chip =
            t.status === "not_enough_history"
              ? { text: "too few deals to call", tone: "grey" as const }
              : t.status === "accelerating"
                ? { text: `▲ ${ratio ? `${ratio.toFixed(1)}×` : "up"} · ${t.thisWeek} vs ${t.baselineAvg.toFixed(1)}`, tone: "amber" as const }
                : t.status === "slowing"
                  ? { text: `▼ ${ratio !== null ? `${ratio.toFixed(1)}×` : "down"} · ${t.thisWeek} vs ${t.baselineAvg.toFixed(1)}`, tone: "grey" as const }
                  : { text: `${t.thisWeek} vs ${t.baselineAvg.toFixed(1)}`, tone: "grey" as const };
          return (
            <li key={t.sector} className="grid gap-1.5 md:grid-cols-[8.5rem_1fr_auto] md:items-center md:gap-3">
              <span className="flex items-center gap-1.5 text-[13px]">
                <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                <span className="truncate">{shortSector(t.sector)}</span>
              </span>
              <div className="relative h-6">
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
                {/* the line draws from the average toward this week */}
                <motion.div
                  className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
                  style={{ left: `${lo}%`, width: `${hi - lo}%`, background: color, opacity: 0.55, transformOrigin: a <= n ? "left" : "right" }}
                  {...inView(animate, { scaleX: 0 }, { scaleX: 1 }, { duration: 0.5, delay: 0.25 + delay, ease: EASE_OUT })}
                />
                <motion.span
                  className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card"
                  style={{ left: `${a}%`, borderColor: color }}
                  {...inView(animate, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1 }, { type: "spring", stiffness: 400, damping: 22, delay })}
                />
                <motion.span
                  className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ background: color }}
                  {...inView(animate, { left: `${a}%`, opacity: 0 }, { left: `${n}%`, opacity: 1 }, { type: "spring", stiffness: 140, damping: 16, delay: 0.5 + delay })}
                />
              </div>
              <motion.span
                className={cn("fig w-fit rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", chip.tone === "amber" ? "bg-warning-soft text-warning-ink" : "bg-secondary text-ink-2")}
                {...inView(animate, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1 }, { type: "spring", stiffness: 420, damping: 18, delay: 0.95 + delay })}
              >
                {chip.text}
              </motion.span>
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full border-2 border-muted-foreground" /> four-week average
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-muted-foreground" /> this week
        </span>
        {rows.some((t) => t.status === "not_enough_history") ? <span>&ldquo;Too few deals to call&rdquo; means the earlier weeks have too few deals to judge a trend.</span> : null}
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* New faces at the table                                              */
/* ------------------------------------------------------------------ */

/** New investors (new in our records) per sector, as bars that rise from the bottom. */
export function FacesChart({ entries, sectors }: { entries: NewInvestorEntry[]; sectors: string[] }) {
  const animate = useAnimate();
  const counts = new Map<string, Set<string>>();
  for (const e of entries) counts.set(e.sector, (counts.get(e.sector) ?? new Set()).add(e.investor.toLowerCase()));
  const rows = [...new Set([...sectors, ...counts.keys()])].map((s) => ({ sector: s, n: counts.get(s)?.size ?? 0 })).filter((r) => r.n > 0 || sectors.includes(r.sector));
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!entries.length) return <p className="py-6 text-center text-sm text-muted-foreground">No new investors in our records this week.</p>;
  return (
    <figure aria-label="New investors by sector" className="m-0">
      <p className="sr-only">New investors in our records by sector: {rows.map((r) => `${r.sector} ${r.n}`).join("; ")}.</p>
      <div aria-hidden className="flex h-36 items-end gap-3 border-b px-1">
        {rows.map((r, i) => (
          <div key={r.sector} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <motion.span className="fig text-xs font-medium" {...inView(animate, { opacity: 0 }, { opacity: 1 }, { delay: 0.4 + i * 0.07 })}>
              {r.n}
            </motion.span>
            <motion.div
              className="w-full max-w-12 rounded-t-md"
              style={{ background: sectorColor(r.sector), opacity: r.n ? 1 : 0.25, minHeight: 3 }}
              {...inView(animate, { height: 0 }, { height: `${Math.max(3, (r.n / max) * 100 - 14)}%` }, { type: "spring", stiffness: 130, damping: 14, delay: i * 0.07 })}
            />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-1.5 flex gap-3 px-1">
        {rows.map((r) => (
          <span key={r.sector} className="flex-1 text-center text-[11px] leading-tight text-muted-foreground">
            {shortSector(r.sector)}
          </span>
        ))}
      </div>
    </figure>
  );
}
