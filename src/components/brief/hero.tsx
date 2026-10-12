"use client";

import { useRef } from "react";
import { Sparkles } from "lucide-react";
import { InfoTip } from "@/components/common/info-tip";
import { Sparkline } from "@/components/common/sparkline";
import { CountNumber, RollText, WordReveal } from "@/components/common/motion-bits";
import { Rise } from "@/components/common/motion-bits";
import { useConfig } from "@/lib/client/api";
import { formatInr, formatUsd } from "@/lib/money";
import { formatWeekRange } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useNav } from "@/components/dashboard/nav";
import { buildExplanations, ExplainBody, type Explain } from "./kpi-explain";
import { weekBullets, weekHeadline } from "./derive";
import type { DigestView } from "@/lib/view-types";

function Tile({ label, explain, children, sub, onClick, index, spark }: { label: string; explain: Explain; children: React.ReactNode; sub?: React.ReactNode; onClick?: () => void; index: number; spark?: React.ReactNode }) {
  const nav = useNav();
  const Wrapper = onClick ? "button" : "div";
  return (
    <Rise index={index} className="relative min-w-[10.5rem] snap-start md:min-w-0">
      <Wrapper
        {...(onClick ? { type: "button" as const, onClick } : {})}
        className={cn("relative flex h-full w-full flex-col rounded-xl border bg-background/60 p-3.5 text-left transition-[border-color,transform] duration-200", onClick && "cursor-pointer outline-none hover:-translate-y-0.5 hover:border-ring/50 focus-visible:ring-2 focus-visible:ring-ring")}
      >
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          {label}
          {/* the info icon sits inside the tile; its own button keeps it separate from the tile's click */}
        </span>
        <span className="mt-1 text-[1.75rem] leading-none font-medium tracking-tight">{children}</span>
        {sub ? <span className={cn("mt-1.5 text-xs text-muted-foreground", spark && "max-w-[calc(100%-4.75rem)]")}>{sub}</span> : null}
        {spark ? <span className="pointer-events-none absolute right-3 bottom-3">{spark}</span> : null}
      </Wrapper>
      <span className="absolute top-2.5 right-2.5">
        <InfoTip label={`What is ${label}?`} width="w-[22rem]">
          {(close) => (
            <ExplainBody
              e={explain}
              onGo={() => {
                close();
                nav.jump(explain.tab, explain.target);
              }}
            />
          )}
        </InfoTip>
      </span>
    </Rise>
  );
}

export function Hero({ view, onOpenFocus }: { view: DigestView; onOpenFocus: () => void }) {
  const { data: cfg } = useConfig();
  const d = view.digest!;
  const k = d.kpis;
  const c = d.patterns.computed;
  const ex = buildExplanations(view, cfg);
  const delta = k.prevDeals !== undefined && k.prevDeals > 0 ? k.deals - k.prevDeals : null;
  const direct = k.directHits ?? k.watchlistHits;
  const topDeals = c.capital.find((x) => x.sector === k.topSector)?.deals;
  const interest = new Set(c.newInvestors.filter((n) => n.onWatchlist).map((n) => n.investor.toLowerCase())).size;
  const headline = weekHeadline(view);
  const bullets = weekBullets(view);
  // The second clause (after a colon, dash or the first comma) is set in italic amber.
  const words = headline.split(/\s+/);
  const clauseAt = words.findIndex((w, i) => i >= 3 && i <= words.length - 3 && /[:,—–]$/.test(w));
  const italicFrom = clauseAt >= 0 ? clauseAt + 1 : undefined;
  const ref = useRef<HTMLDivElement>(null);

  return (
    <Rise as="section" className="col-span-12 rounded-[16px] border bg-card p-4 md:p-6" >
      <div ref={ref} className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="min-w-0 lg:col-span-7">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Sparkles className="size-4" />
            </span>
            <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">The week in one line</p>
            <span className="fig ml-auto text-xs text-muted-foreground">{view.week ? formatWeekRange(view.week) : ""}</span>
          </div>
          <h1 className="display mt-4 text-[2rem] leading-[1.1] md:text-[2.6rem]">
            <WordReveal key={headline} text={headline} italicFrom={italicFrom} />
          </h1>
          <ul className="mt-5 grid gap-2.5">
            {bullets.map((b, i) => (
              <Rise as="li" key={`${i}-${b}`} index={i + 4} className="flex gap-2.5 text-[15px] text-ink-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{b}</span>
              </Rise>
            ))}
          </ul>
          {d.analysis.source === "template" ? (
            <p className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-ink">
              {d.analysis.reason === "ai_unavailable" ? "Written from a template because the AI service was unavailable. The numbers are unaffected." : "A plain summary written from the numbers. The latest digest has the full AI explanation."}
            </p>
          ) : null}
          {d.emailedAt ? <p className="mt-4 text-xs text-muted-foreground">Emailed to the digest list.</p> : null}
        </div>

        <div className="relative min-w-0 lg:col-span-5">
          <div role="group" aria-label="Key numbers" className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
            <Tile index={0} label="Deals" explain={ex.deals} spark={<Sparkline label="Deals per week, last weeks" values={view.history.map((h) => h.deals)} />} sub={delta === null ? undefined : `${delta >= 0 ? "+" : ""}${delta} vs last week`}>
              <CountNumber value={k.deals} />
            </Tile>
            <Tile index={1} label="Capital disclosed" explain={ex.capital} spark={<Sparkline label="Disclosed capital per week, last weeks" values={view.history.map((h) => h.disclosedUsd)} />} sub={k.disclosedUsd > 0 ? <span className="fig">{formatUsd(k.disclosedUsd)}{k.undisclosedCount ? ` · ${k.undisclosedCount} undisclosed` : ""}</span> : "None disclosed"}>
              <CountNumber value={k.disclosedInr} format={(n) => (k.disclosedUsd > 0 ? formatInr(n) : "None")} />
            </Tile>
            <Tile index={2} label="Watchlist hits" explain={ex.watch} sub="Names you follow, in the news">
              <CountNumber value={direct} />
              {k.adjacentHits ? <span className="fig ml-1.5 text-sm font-normal text-warning-ink">+{k.adjacentHits} near</span> : null}
            </Tile>
            <Tile index={3} label="New investors" explain={ex.investors} sub={interest ? `${interest} of interest` : "New in our records"}>
              <CountNumber value={k.newInvestors} />
            </Tile>
            <Tile index={4} label="Top sector" explain={ex.top} sub={k.topSector ? <span className="fig">{k.topSectorUsd ? `${formatUsd(k.topSectorUsd)} · ` : ""}{topDeals ?? 0} deals</span> : undefined}>
              <RollText text={k.topSector ?? "None yet"} className="text-lg leading-tight" />
            </Tile>
            <Tile index={5} label="Focus deals" explain={ex.focus} sub="Tap to open the list" onClick={onOpenFocus}>
              <CountNumber value={c.focusDealIds.length} />
            </Tile>
          </div>
        </div>
      </div>
    </Rise>
  );
}
