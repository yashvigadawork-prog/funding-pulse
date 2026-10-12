"use client";

import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatInr, formatUsd } from "@/lib/money";
import { formatWeekRange } from "@/lib/time";
import type { TabId } from "@/components/dashboard/nav";
import type { ConfigResponse } from "@/lib/client/types";
import type { DigestView } from "@/lib/view-types";

export interface Explain {
  title: string;
  what: string;
  how: string[];
  thisWeek: string;
  look: string;
  tab: TabId;
  target: string;
  targetLabel: string;
}

/** The "What is this?" text for every tile, word for word as it was in the side panel. Now shown in an info tooltip. */
export function buildExplanations(view: DigestView, cfg: ConfigResponse | undefined) {
  const k = view.digest!.kpis;
  const delta = k.prevDeals !== undefined && k.prevDeals > 0 ? k.deals - k.prevDeals : null;
  const direct = k.directHits ?? k.watchlistHits;
  const rate = cfg?.fund_profile.usd_inr_rate;
  const days = cfg?.digest_settings.adjacency_window_days ?? 10;
  const weekLabel = view.week ? formatWeekRange(view.week) : "this week";
  const focus = view.digest!.patterns.computed.focusDealIds.length;

  const deals: Explain = {
    title: "Deals",
    what: "How many startup funding rounds were announced during the week.",
    how: [
      "Each news article is read and every funding round in it is pulled out (equity or debt).",
      "The same round reported by several outlets is merged into one deal, with every source link kept.",
      "Acquisitions, IPOs and grants are left out.",
    ],
    thisWeek: `${k.deals} deals for ${weekLabel}${delta === null ? "" : `, which is ${Math.abs(delta)} ${delta >= 0 ? "more" : "fewer"} than the week before`}. A typical week has ${view.quality.typicalVolume.min} to ${view.quality.typicalVolume.max} announcements.`,
    look: "The table of every deal this week, grouped by sector. Select a row to see the stage, amount, investors, founders and all source links.",
    tab: "market",
    target: "all-deals",
    targetLabel: "all deals this week",
  };
  const capital: Explain = {
    title: "Disclosed capital",
    what: "The total money raised, counting only deals where the amount was actually reported.",
    how: [
      "Amounts are added up in code, never by the AI. Rupee amounts are shown in lakh and crore.",
      `Dollar and rupee figures are converted with the rate set in Settings${rate ? ` (currently ${rate} rupees to the dollar)` : ""}.`,
      "A deal with no reported amount is never estimated and never added in. It is counted as a deal and listed separately.",
    ],
    thisWeek: k.disclosedUsd > 0 ? `${formatInr(k.disclosedInr)} (${formatUsd(k.disclosedUsd)}) across the deals that reported an amount. ${k.undisclosedCount} ${k.undisclosedCount === 1 ? "deal" : "deals"} did not disclose an amount.` : "No amounts were disclosed this week.",
    look: 'The chart under "Where the money went" shows the amount per sector next to its usual weekly amount. The deals with an undisclosed amount are listed under "Which sectors are attracting capital?" on the Market tab.',
    tab: "brief",
    target: "card-money",
    targetLabel: "the capital chart",
  };
  const top: Explain = {
    title: "Top sector",
    what: "The sector that attracted the most disclosed money this week.",
    how: [
      "Sectors come from the Sector keywords in Settings. Matching uses whole words only.",
      '"Other" is a catch-all bucket, so it only leads if no named sector has any deals.',
      "If no amounts were disclosed, the sector with the most deals is shown instead.",
    ],
    thisWeek: k.topSector ? `${k.topSector}${k.topSectorUsd ? `, with ${formatUsd(k.topSectorUsd)} disclosed.` : ", by number of deals (no amounts disclosed)."}` : "No deals yet.",
    look: 'The "Where the money went" chart compares every sector. "Who\'s heating up" shows whether a sector is busier than its recent average.',
    tab: "brief",
    target: "card-money",
    targetLabel: "the sector comparison",
  };
  const watch: Explain = {
    title: "Watchlist hits",
    what: "Funding news that touches the companies you follow.",
    how: [
      "Direct: a company on your Portfolio or On Radar list was itself named in a funding article.",
      `Adjacent (shown as "near"): a deal in the same sector as a Portfolio company, with enough shared words in the descriptions, within the last ${days} days. Two or more such companies near one Portfolio company is flagged as a cluster.`,
      "Names that only nearly match a company on your lists are not counted. They wait in the Needs review list.",
    ],
    thisWeek: `${direct} direct${k.adjacentHits ? `, plus ${k.adjacentHits} adjacent${k.adjacentClusters ? ` (${k.adjacentClusters} ${k.adjacentClusters === 1 ? "cluster" : "clusters"})` : ""}` : ", none adjacent"}.${view.quality.needsReview ? ` ${view.quality.needsReview} near-miss ${view.quality.needsReview === 1 ? "name is" : "names are"} in Needs review.` : ""}`,
    look: "The Your names in the news card lists each direct hit with why it matched, and each adjacent group with the words they share and the links.",
    tab: "brief",
    target: "card-names",
    targetLabel: "Your names in the news",
  };
  const investors: Explain = {
    title: "New investors",
    what: "Investors who showed up in one of your focus sectors this week and have not appeared there before in our records.",
    how: [
      "It compares this week against every earlier deal we have stored for that sector.",
      '"New in our records" is not the same as new to the market: an investor may have been active for years before this app started collecting.',
      'Placeholder names such as "existing investors" are ignored, and sectors with too little history are skipped.',
    ],
    thisWeek: `${k.newInvestors} investors are new in our records. With only a few weeks of history stored, this number is high at first and will settle as more weeks are collected.`,
    look: 'The "New faces at the table" card shows the count per sector and the investors you watch. The full list is under "Has a new investor started moving in our target sectors?" on the Market tab.',
    tab: "brief",
    target: "card-faces",
    targetLabel: "the new-investor card",
  };
  const focusEx: Explain = {
    title: "Focus deals",
    what: "Deals that fit the mandate: a focus sector and a stage the family office invests in.",
    how: [
      "Focus sector and a stage the mandate invests in. Series B+ only when the company is on your lists.",
      "The sectors and stages come from the Mandate tab in My Coverage.",
    ],
    thisWeek: `${focus} ${focus === 1 ? "deal" : "deals"} this week fit the mandate.`,
    look: "Select this tile to open the list, with each deal's stage, amount and sources.",
    tab: "brief",
    target: "card-fit",
    targetLabel: "Deals that fit the mandate",
  };
  return { deals, capital, top, watch, investors, focus: focusEx };
}

export function ExplainBody({ e, onGo }: { e: Explain; onGo: () => void }) {
  return (
    <div className="grid gap-3">
      <div>
        <p className="font-semibold">{e.title}</p>
        <p className="mt-0.5 text-muted-foreground">{e.what}</p>
      </div>
      <div className="rounded-lg bg-accent/70 p-2.5">
        <p className="text-xs font-medium text-accent-foreground">This week</p>
        <p className="mt-0.5">{e.thisWeek}</p>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">How it is worked out</p>
        <ul className="mt-1 grid list-disc gap-1 pl-4 text-muted-foreground">
          {e.how.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Where to look for more</p>
        <p className="mt-1 text-muted-foreground">{e.look}</p>
        <Button size="sm" className="mt-2" onClick={onGo}>
          <ArrowDown data-icon="inline-start" /> Go to {e.targetLabel}
        </Button>
      </div>
    </div>
  );
}
