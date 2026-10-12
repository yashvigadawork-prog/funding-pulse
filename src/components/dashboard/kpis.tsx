"use client";

import { useState } from "react";
import { ArrowDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useConfig } from "@/lib/client/api";
import { formatWeekRange } from "@/lib/time";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCountUp } from "@/lib/client/hooks";
import { formatInr, formatUsd } from "@/lib/money";
import { timeAgo, plural } from "@/lib/format";
import { Banner } from "@/components/common/states";
import type { DigestView } from "@/lib/view-types";

function Count({ value, format }: { value: number; format: (n: number) => string }) {
  const v = useCountUp(value);
  return <>{format(v)}</>;
}

interface Explain {
  title: string;
  what: string;
  how: string[];
  thisWeek: string;
  look: string;
  target: string;
  targetLabel: string;
}

function Card({ label, children, sub, explain, onOpen }: { label: string; children: React.ReactNode; sub?: React.ReactNode; explain: Explain; onOpen: (e: Explain) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(explain)}
      aria-haspopup="dialog"
      className="group flex flex-col rounded-xl border bg-card p-4 text-left outline-none transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="mt-1 text-2xl font-semibold tracking-tight">{children}</span>
      {sub ? <span className="mt-1 text-xs text-muted-foreground">{sub}</span> : null}
      <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-medium text-primary">
        <Info className="size-3" aria-hidden /> What is this?
      </span>
    </button>
  );
}

function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

function ExplainDrawer({ item, onClose }: { item: Explain | null; onClose: () => void }) {
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="data-[side=right]:sm:max-w-md">
        {item ? (
          <>
            <SheetHeader>
              <SheetTitle>{item.title}</SheetTitle>
              <SheetDescription>{item.what}</SheetDescription>
            </SheetHeader>
            <div className="grid flex-1 content-start gap-5 overflow-y-auto px-4 pb-6 text-sm">
              <div className="rounded-lg bg-accent/60 p-3">
                <p className="text-xs font-medium text-accent-foreground">This week</p>
                <p className="mt-1">{item.thisWeek}</p>
              </div>
              <div>
                <h3 className="font-semibold">How it is worked out</h3>
                <ul className="mt-1.5 grid list-disc gap-1.5 pl-5 text-muted-foreground">
                  {item.how.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold">Where to look for more</h3>
                <p className="mt-1.5 text-muted-foreground">{item.look}</p>
                <Button
                  className="mt-3"
                  onClick={() => {
                    onClose();
                    window.setTimeout(() => jumpTo(item.target), 250);
                  }}
                >
                  <ArrowDown data-icon="inline-start" /> Go to {item.targetLabel}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function KpiStrip({ view }: { view: DigestView }) {
  const { data: cfg } = useConfig();
  const [open, setOpen] = useState<Explain | null>(null);
  const k = view.digest?.kpis;
  if (!k) return null;
  const delta = k.prevDeals !== undefined && k.prevDeals > 0 ? k.deals - k.prevDeals : null;
  const direct = k.directHits ?? k.watchlistHits;
  const rate = cfg?.fund_profile.usd_inr_rate;
  const days = cfg?.digest_settings.adjacency_window_days ?? 10;
  const weekLabel = view.week ? formatWeekRange(view.week) : "this week";

  const dealsExplain: Explain = {
    title: "Deals",
    what: "How many startup funding rounds were announced during the week.",
    how: [
      "Each news article is read and every funding round in it is pulled out (equity or debt).",
      "The same round reported by several outlets is merged into one deal, with every source link kept.",
      "Acquisitions, IPOs and grants are left out.",
    ],
    thisWeek: `${k.deals} deals for ${weekLabel}${delta === null ? "" : `, which is ${Math.abs(delta)} ${delta >= 0 ? "more" : "fewer"} than the week before`}. A typical week has ${view.quality.typicalVolume.min} to ${view.quality.typicalVolume.max} announcements.`,
    look: "The table of every deal this week, grouped by sector. Select a row to see the stage, amount, investors, founders and all source links.",
    target: "all-deals",
    targetLabel: "all deals this week",
  };
  const capitalExplain: Explain = {
    title: "Disclosed capital",
    what: "The total money raised, counting only deals where the amount was actually reported.",
    how: [
      "Amounts are added up in code, never by the AI. Rupee amounts are shown in lakh and crore.",
      `Dollar and rupee figures are converted with the rate set in Settings${rate ? ` (currently ${rate} rupees to the dollar)` : ""}.`,
      "A deal with no reported amount is never estimated and never added in. It is counted as a deal and listed separately.",
    ],
    thisWeek: k.disclosedUsd > 0 ? `${formatInr(k.disclosedInr)} (${formatUsd(k.disclosedUsd)}) across the deals that reported an amount. ${k.undisclosedCount} ${k.undisclosedCount === 1 ? "deal" : "deals"} did not disclose an amount.` : "No amounts were disclosed this week.",
    look: "The chart under \"Which sectors are attracting capital?\" shows the amount per sector next to its usual weekly amount, and lists the deals with an undisclosed amount.",
    target: "pattern-capital",
    targetLabel: "the capital chart",
  };
  const topExplain: Explain = {
    title: "Top sector",
    what: "The sector that attracted the most disclosed money this week.",
    how: [
      "Sectors come from the Sector keywords in Settings. Matching uses whole words only.",
      "\"Other\" is a catch-all bucket, so it only leads if no named sector has any deals.",
      "If no amounts were disclosed, the sector with the most deals is shown instead.",
    ],
    thisWeek: k.topSector ? `${k.topSector}${k.topSectorUsd ? `, with ${formatUsd(k.topSectorUsd)} disclosed.` : ", by number of deals (no amounts disclosed)."}` : "No deals yet.",
    look: "The capital chart compares every sector. The question after it, \"Is activity speeding up or slowing?\", shows whether a sector is busier than its recent average.",
    target: "pattern-capital",
    targetLabel: "the sector comparison",
  };
  const watchExplain: Explain = {
    title: "Watchlist hits",
    what: "Funding news that touches the companies you follow.",
    how: [
      "Direct: a company on your Portfolio or On Radar list was itself named in a funding article.",
      `Adjacent: a deal in the same sector as a Portfolio company, with enough shared words in the descriptions, within the last ${days} days. Two or more such companies near one Portfolio company is flagged as a cluster.`,
      "Names that only nearly match a company on your lists are not counted. They wait in the Needs review list.",
    ],
    thisWeek: `${direct} direct${k.adjacentHits ? `, plus ${k.adjacentHits} adjacent${k.adjacentClusters ? ` (${k.adjacentClusters} ${k.adjacentClusters === 1 ? "cluster" : "clusters"})` : ""}` : ", none adjacent"}.${view.quality.needsReview ? ` ${view.quality.needsReview} near-miss ${view.quality.needsReview === 1 ? "name is" : "names are"} in Needs review.` : ""}`,
    look: "The Watchlist hits section lists each direct hit with why it matched, and each adjacent group with the words they share and the links.",
    target: "s1-watch",
    targetLabel: "Watchlist hits",
  };
  const investorsExplain: Explain = {
    title: "New investors",
    what: "Investors who showed up in one of your focus sectors this week and have not appeared there before in our records.",
    how: [
      "It compares this week against every earlier deal we have stored for that sector.",
      "\"New in our records\" is not the same as new to the market: an investor may have been active for years before this app started collecting.",
      "Placeholder names such as \"existing investors\" are ignored, and sectors with too little history are skipped.",
    ],
    thisWeek: `${k.newInvestors} investors are new in our records. With only a few weeks of history stored, this number is high at first and will settle as more weeks are collected.`,
    look: "The third question, \"Has a new investor started moving in our target sectors?\", names them (investors you watch come first) and shows the count per sector.",
    target: "pattern-new_investors",
    targetLabel: "the new-investor panel",
  };

  return (
    <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Card label="Deals" explain={dealsExplain} onOpen={setOpen} sub={delta === null ? undefined : `${delta >= 0 ? "+" : ""}${delta} vs the week before`}>
        <Count value={k.deals} format={(n) => String(Math.round(n))} />
      </Card>
      <Card label="Disclosed capital" explain={capitalExplain} onOpen={setOpen} sub={k.undisclosedCount ? `${formatUsd(k.disclosedUsd)}. ${plural(k.undisclosedCount, "deal")} undisclosed, not counted` : formatUsd(k.disclosedUsd)}>
        <Count value={k.disclosedInr} format={(n) => (k.disclosedUsd > 0 ? formatInr(n) : "None disclosed")} />
      </Card>
      <Card label="Top sector" explain={topExplain} onOpen={setOpen} sub={k.topSectorUsd ? `${formatUsd(k.topSectorUsd)} disclosed` : k.topSector ? "Most deals; no amounts disclosed" : undefined}>
        <span className="text-lg leading-tight">{k.topSector ?? "None yet"}</span>
      </Card>
      <Card label="Watchlist hits" explain={watchExplain} onOpen={setOpen} sub={`Direct: company named.${k.adjacentHits ? ` Plus ${k.adjacentHits} adjacent to your portfolio.` : ""}`}>
        <Count value={direct} format={(n) => String(Math.round(n))} />
        {k.adjacentHits ? <span className="ml-2 text-sm font-normal text-muted-foreground">+{k.adjacentHits} adjacent</span> : null}
      </Card>
      <Card label="New investors" explain={investorsExplain} onOpen={setOpen} sub="New in our records for their sector">
        <Count value={k.newInvestors} format={(n) => String(Math.round(n))} />
      </Card>
      <ExplainDrawer item={open} onClose={() => setOpen(null)} />
    </section>
  );
}

export function QualityStrip({ view }: { view: DigestView }) {
  const q = view.quality;
  const below = view.digest && q.dealsFound < q.typicalVolume.min;
  const unreachable = q.sources?.unreachable ?? [];
  const items: { label: string; value: React.ReactNode; tip?: string }[] = [
    {
      label: "Sources reachable",
      value: q.sources ? `${q.sources.reachable} of ${q.sources.total}` : "Not checked yet",
      tip: unreachable.length ? `Could not read the feed of: ${unreachable.join(", ")}.${q.sources?.searchedInstead.length ? ` Searched their websites instead: ${q.sources.searchedInstead.join(", ")}.` : ""}` : q.sources ? "All sources answered" : undefined,
    },
    { label: "Articles read this week", value: q.articlesRead },
    { label: "Deals found (duplicates merged)", value: `${q.dealsFound} · typical ${q.typicalVolume.min} to ${q.typicalVolume.max}` },
    { label: "Amount undisclosed", value: q.undisclosed },
    { label: "Needs review", value: <a href="#needs-review" className="underline underline-offset-2">{q.needsReview}</a> },
    { label: "Last updated", value: q.lastUpdatedAt ? timeAgo(q.lastUpdatedAt) : "never" },
  ];
  return (
    <section aria-label="Data quality" className="grid gap-2">
      <dl className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border bg-surface px-4 py-2.5 text-xs">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">{it.label}:</dt>
            <dd className="font-medium">
              {it.tip ? (
                <Tooltip>
                  <TooltipTrigger render={<button type="button" className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2" />}>
                    {it.value}
                    <Info className="size-3" aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent>{it.tip}</TooltipContent>
                </Tooltip>
              ) : (
                it.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {below ? (
        <p className="px-1 text-xs text-muted-foreground">
          Below the typical weekly volume. Possible reasons: some sources unreachable, or earlier weeks not yet collected.
        </p>
      ) : null}
    </section>
  );
}

export function StatusBanners({ view }: { view: DigestView }) {
  const q = view.quality;
  const out: React.ReactNode[] = [];
  if (q.daysOld !== null && q.daysOld > 8)
    out.push(
      <Banner key="stale" tone="warn" title={`Last updated ${q.daysOld} days ago`}>
        The numbers below may be out of date. Press Refresh now to collect the latest news.
      </Banner>,
    );
  if (q.searchUnavailable)
    out.push(
      <Banner key="search" tone="warn" title="Live search is unavailable">
        Showing stored data from {q.lastUpdatedAt ? timeAgo(q.lastUpdatedAt) : "the last run"}.
      </Banner>,
    );
  if (q.partialRun)
    out.push(
      <Banner key="partial" tone="info" title="Some articles are still waiting">
        Press Refresh again to continue.
      </Banner>,
    );
  if (!out.length) return null;
  return <div className="grid gap-2">{out}</div>;
}
