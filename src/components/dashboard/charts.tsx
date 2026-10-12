"use client";

import { createContext, useContext } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePrefersReducedMotion } from "@/lib/client/hooks";
import { formatUsd } from "@/lib/money";
import { SECTOR_VAR } from "@/components/common/ui-bits";
import type { NewInvestorEntry, SectorCapital, SectorTrend } from "@/lib/pipeline/compute";

export const shortSector = (s: string) =>
  ({ "Health & wellness": "Health", "Climate & sustainability": "Climate", "Media, deeptech & education": "Media, deeptech, edu" })[s] ?? s;

const DRAW_MS = 600;

/** The print report switches chart animation off so charts are complete when the page is printed. */
export const StaticChartsContext = createContext(false);
function useAnimate() {
  const reduced = usePrefersReducedMotion();
  const isStatic = useContext(StaticChartsContext);
  return !reduced && !isStatic;
}
const tick = { fill: "var(--muted-foreground)", fontSize: 11 };

function TooltipBox({ active, payload, label, render }: { active?: boolean; payload?: { payload: Record<string, unknown> }[]; label?: string; render: (row: Record<string, unknown>) => React.ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {render(payload[0].payload)}
    </div>
  );
}

/** Disclosed capital per sector this week, with the baseline weekly average beside it. */
export function CapitalChart({ capital, compact }: { capital: SectorCapital[]; compact?: boolean }) {
  const animate = useAnimate();
  const rows = capital.filter((c) => c.deals > 0 || c.baselineAvgUsd > 0).map((c) => ({ label: shortSector(c.sector), sector: c.sector, usd: c.disclosedUsd, baseline: c.baselineAvgUsd, deals: c.deals, undisclosed: c.undisclosed.length }));
  const summary = rows.length
    ? `Disclosed capital this week by sector: ${rows.map((r) => `${r.sector} ${r.usd ? formatUsd(r.usd) : "none disclosed"} across ${r.deals} deals`).join("; ")}.`
    : "No deals this week.";
  if (!rows.length) return <p className="py-6 text-center text-xs text-muted-foreground">No deals this week.</p>;
  return (
    <figure aria-label="Disclosed capital by sector" className="m-0">
      <p className="sr-only">{summary}</p>
      <div aria-hidden style={{ height: compact ? 120 : 40 + rows.length * (compact ? 24 : 46) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
            {!compact ? <CartesianGrid horizontal={false} stroke="var(--border)" /> : null}
            <XAxis type="number" hide={compact} tick={tick} tickFormatter={(v) => formatUsd(v)} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={compact ? 62 : 110} tick={tick} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<TooltipBox render={(r) => (
              <div className="grid gap-0.5">
                <span>This week: {Number(r.usd) ? formatUsd(Number(r.usd)) : "none disclosed"}</span>
                <span>Deals: {String(r.deals)}{Number(r.undisclosed) ? ` (${r.undisclosed} undisclosed)` : ""}</span>
                <span className="text-muted-foreground">Weekly baseline: {formatUsd(Number(r.baseline))}</span>
              </div>
            )} />} />
            {!compact ? <Bar dataKey="baseline" fill="var(--muted-foreground)" fillOpacity={0.35} radius={3} barSize={9} isAnimationActive={animate} animationDuration={DRAW_MS} /> : null}
            <Bar dataKey="usd" radius={3} barSize={compact ? 12 : 14} isAnimationActive={animate} animationDuration={DRAW_MS}>
              {rows.map((r) => (
                <Cell key={r.sector} fill={SECTOR_VAR[r.sector] ?? "var(--sector-other)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Deal counts this week against the baseline weekly average for each sector. */
export function MomentumChart({ trends, compact }: { trends: SectorTrend[]; compact?: boolean }) {
  const animate = useAnimate();
  const rows = trends.filter((t) => (compact ? t.isFocus : t.isFocus || t.thisWeek > 0 || t.baselineTotal > 0)).map((t) => ({ label: shortSector(t.sector), sector: t.sector, now: t.thisWeek, avg: Math.round(t.baselineAvg * 10) / 10, status: t.status }));
  const label = (s: string) => (s === "not_enough_history" ? "not enough history" : s);
  const summary = `Deals this week against the baseline average: ${rows.map((r) => `${r.sector} ${r.now} against ${r.avg} (${label(r.status)})`).join("; ")}.`;
  if (!rows.length) return <p className="py-6 text-center text-xs text-muted-foreground">No history yet.</p>;
  return (
    <figure aria-label="Deal counts against baseline" className="m-0">
      <p className="sr-only">{summary}</p>
      <div aria-hidden style={{ height: compact ? 120 : 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: -18, right: 4, top: 4, bottom: 0 }}>
            {!compact ? <CartesianGrid vertical={false} stroke="var(--border)" /> : null}
            <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={0} hide={compact} />
            <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} hide={compact} />
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<TooltipBox render={(r) => (
              <div className="grid gap-0.5">
                <span>This week: {String(r.now)} deals</span>
                <span>Baseline average: {String(r.avg)}</span>
                <span className="text-muted-foreground">{label(String(r.status))}</span>
              </div>
            )} />} />
            <Bar dataKey="avg" fill="var(--muted-foreground)" fillOpacity={0.35} radius={3} isAnimationActive={animate} animationDuration={DRAW_MS} />
            <Bar dataKey="now" radius={3} isAnimationActive={animate} animationDuration={DRAW_MS}>
              {rows.map((r) => (
                <Cell key={r.sector} fill={SECTOR_VAR[r.sector] ?? "var(--sector-other)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** How many investors are new in our records, per sector. */
export function NewInvestorChart({ entries, compact }: { entries: NewInvestorEntry[]; compact?: boolean }) {
  const animate = useAnimate();
  const bySector = new Map<string, number>();
  for (const e of entries) bySector.set(e.sector, (bySector.get(e.sector) ?? 0) + 1);
  const rows = [...bySector.entries()].map(([sector, n]) => ({ sector, label: shortSector(sector), n }));
  if (!rows.length) return <p className="py-6 text-center text-xs text-muted-foreground">No new investors in our records this week.</p>;
  return (
    <figure aria-label="New investors by sector" className="m-0">
      <p className="sr-only">New investors in our records by sector: {rows.map((r) => `${r.sector} ${r.n}`).join("; ")}.</p>
      <div aria-hidden style={{ height: compact ? 120 : 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: -18, right: 4, top: 4, bottom: 0 }}>
            <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={0} hide={compact} />
            <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} hide={compact} />
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<TooltipBox render={(r) => <span>{String(r.n)} new investor{r.n === 1 ? "" : "s"}</span>} />} />
            <Bar dataKey="n" radius={3} isAnimationActive={animate} animationDuration={DRAW_MS}>
              {rows.map((r) => (
                <Cell key={r.sector} fill={SECTOR_VAR[r.sector] ?? "var(--sector-other)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
