/** A small stored digest for tests. Not used by the app. */
import type { DigestView } from "@/lib/view-types";

const cap = (sector: string, deals: number, usd: number, base: number) => ({ sector, deals, disclosedUsd: usd, disclosedInr: usd * 90, disclosedCount: deals, undisclosed: [], baselineAvgUsd: base });
const trend = (sector: string, thisWeek: number, avg: number, status: "accelerating" | "steady") => ({ sector, isFocus: true, thisWeek, baselineTotal: avg * 4, baselineAvg: avg, ratio: avg ? thisWeek / avg : null, extra: thisWeek - avg, status, series: [] });

export function fixtureView(): DigestView {
  return {
    weeks: [],
    week: "2026-10-05",
    history: [{ week: "2026-09-28", deals: 10, disclosedUsd: 5e6 }, { week: "2026-10-05", deals: 24, disclosedUsd: 4e8 }],
    defaultWeek: "2026-10-05",
    fundName: "Cloudburst Ventures",
    quality: { sources: null, articlesRead: 10, dealsFound: 3, undisclosed: 1, needsReview: 0, lastUpdatedAt: null, daysOld: 0, fresh: true, typicalVolume: { min: 40, max: 60 }, searchUnavailable: false, partialRun: false },
    deals: [
      { id: 1, companyName: "Zomint", companyId: "z", domain: null, matchTag: "On Radar", matchReason: null, needsReview: false, sector: "Fintech", stage: "Seed", amountText: "$3.7M", amountUsd: 3.7e6, amountInr: 3.3e8, amountMinUsd: null, amountMaxUsd: null, announcedOn: "2026-10-07", confidence: "high", summary: "Wealth app for first-time investors.", stageStatedBy: [], founders: [], investors: [{ name: "Lightspeed", role: "lead", newInSector: false }], sources: [{ url: "https://ex.com/a", outlet: "Entrackr", title: null }], adjacentTo: [] },
      { id: 2, companyName: "River", companyId: null, domain: null, matchTag: null, matchReason: null, needsReview: false, sector: "Climate & sustainability", stage: "Series B+", amountText: "$120M", amountUsd: 1.2e8, amountInr: 1.08e10, amountMinUsd: null, amountMaxUsd: null, announcedOn: "2026-10-10", confidence: "high", summary: "Electric scooters.", stageStatedBy: [], founders: [], investors: [], sources: [], adjacentTo: [] },
    ],
    digest: {
      kpis: { deals: 24, disclosedUsd: 4e8, disclosedInr: 3.6e10, undisclosedCount: 3, topSector: "Media, deeptech & education", topSectorUsd: 2.66e8, watchlistHits: 1, newInvestors: 5, directHits: 1, adjacentHits: 2, prevDeals: 10 },
      highlights: [{ rank: 1, dealId: 1, why: "x", reasons: [], companyName: "Zomint", companyId: "z", matchTag: "On Radar", sector: "Fintech", stage: "Seed", amountText: "$3.7M", amountUsd: 3.7e6, amountInr: 3.3e8, sources: [{ url: "https://ex.com/a", outlet: "Entrackr" }] }],
      patterns: {
        computed: {
          week: "2026-10-05",
          dealIds: [1, 2],
          kpis: { deals: 24, disclosedUsd: 4e8, disclosedInr: 3.6e10, undisclosedCount: 3, topSector: "Media, deeptech & education", topSectorUsd: 2.66e8, watchlistHits: 1, newInvestors: 5, needsReview: 0 },
          capital: [cap("Media, deeptech & education", 14, 266e6, 44e6), cap("Climate & sustainability", 3, 214e6, 50e6), cap("Fintech", 7, 20e6, 10e6)],
          trends: [trend("Fintech", 7, 1.5, "accelerating"), trend("Climate & sustainability", 3, 3, "steady")],
          otherSectorsToNote: [],
          focusDealIds: [1, 2, 3],
          watchlistHits: [{ dealId: 1, tag: "On Radar", companyName: "Zomint" }],
          newInvestors: [{ investor: "3one4 Capital", sector: "Fintech", dealIds: [1], onWatchlist: true }, { investor: "Other Fund", sector: "Fintech", dealIds: [1], onWatchlist: false }],
          sectorsWithoutHistory: [],
        },
        adjacency: [{ portfolioId: "n", portfolioName: "Numocity", sector: "Climate & sustainability", items: [], companies: 2, cluster: true, windowDays: 10, mostRecent: "2026-10-10" }],
        needsReview: [],
        items: [],
      },
      analysis: {
        source: "gemini", model: "x", generatedAt: "2026-10-12T00:00:00Z", weekLine: "Deeptech led the week with $266.4M.", weekBullets: [{ text: "Climate drew $214.3M." }],
        capital: { summary: "s", headline: "Deeptech led capital.", bullets: [{ label: "Reported", text: "Deeptech raised $266.4M.", sources: [] }], points: [] },
        momentum: { summary: "s", headline: "Fintech is speeding up.", bullets: [], points: [] },
        new_investors: { summary: "s", headline: "Several investors are new.", bullets: [], points: [] },
      },
      actions: {},
      emailedAt: null,
      createdAt: "2026-10-12T00:00:00Z",
    },
  } as unknown as DigestView;
}
