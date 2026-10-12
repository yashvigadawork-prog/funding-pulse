"use client";

import { Info } from "lucide-react";
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

function Card({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{children}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function KpiStrip({ view }: { view: DigestView }) {
  const k = view.digest?.kpis;
  if (!k) return null;
  const delta = k.prevDeals !== undefined && k.prevDeals > 0 ? k.deals - k.prevDeals : null;
  const direct = k.directHits ?? k.watchlistHits;
  return (
    <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Card label="Deals" sub={delta === null ? undefined : `${delta >= 0 ? "+" : ""}${delta} vs the week before`}>
        <Count value={k.deals} format={(n) => String(Math.round(n))} />
      </Card>
      <Card label="Disclosed capital" sub={k.undisclosedCount ? `${formatUsd(k.disclosedUsd)}. ${plural(k.undisclosedCount, "deal")} undisclosed, not counted` : formatUsd(k.disclosedUsd)}>
        <Count value={k.disclosedInr} format={(n) => (k.disclosedUsd > 0 ? formatInr(n) : "None disclosed")} />
      </Card>
      <Card label="Top sector" sub={k.topSectorUsd ? `${formatUsd(k.topSectorUsd)} disclosed` : k.topSector ? "Most deals; no amounts disclosed" : undefined}>
        <span className="text-lg leading-tight">{k.topSector ?? "None yet"}</span>
      </Card>
      <Card label="Watchlist hits" sub={`Direct: company named.${k.adjacentHits ? ` Plus ${k.adjacentHits} adjacent to your portfolio.` : ""}`}>
        <Count value={direct} format={(n) => String(Math.round(n))} />
        {k.adjacentHits ? <span className="ml-2 text-sm font-normal text-muted-foreground">+{k.adjacentHits} adjacent</span> : null}
      </Card>
      <Card label="New investors" sub="New in our records for their sector">
        <Count value={k.newInvestors} format={(n) => String(Math.round(n))} />
      </Card>
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
