import { describe, expect, it } from "vitest";
import { classifyTrend, computeWeek, isFocusDeal, type ComputeDeal } from "./compute";
import type { Mandate } from "@/lib/config/schema";

const mandate: Mandate = {
  geography: "India",
  focus_sectors: ["Fintech", "Health & wellness"],
  other_sectors_to_note: true,
  stages: [
    { name: "Seed", focus: true, follow_on_only: false },
    { name: "Series A", focus: true, follow_on_only: false },
    { name: "Series B+", focus: false, follow_on_only: true },
  ],
  ticket_size_usd: { min: null, max: null },
};
const settings = { baseline_weeks: 4, acceleration_ratio: 1.25, slowing_ratio: 0.75, min_baseline_deals: 3, min_extra_deals: 2 };
const sectors = ["Fintech", "Health & wellness", "Other"];

let n = 0;
function deal(o: Partial<ComputeDeal> & { weekStart: string }): ComputeDeal {
  n++;
  return {
    id: n,
    companyName: `Co${n}`,
    companyId: null,
    matchTag: null,
    needsReview: false,
    sector: "Fintech",
    stage: "Seed",
    amountUsd: null,
    amountInr: null,
    announcedOn: o.weekStart,
    investors: [],
    ...o,
  };
}
// Weeks: W = 2026-10-05; baseline weeks 09-07, 09-14, 09-21, 09-28
const W = "2026-10-05";

describe("classifyTrend (hand-checked)", () => {
  // baseline total 8 over 4 weeks = avg 2
  it("accelerating: 5 deals vs avg 2 (ratio 2.5, 3 extra)", () => {
    expect(classifyTrend(5, 8, settings).status).toBe("accelerating");
  });
  it("not accelerating when ratio passes but extra deals are too few: 3 vs avg 2 is only +1", () => {
    expect(classifyTrend(3, 8, settings).status).toBe("steady");
  });
  it("slowing: 1 deal vs avg 2 (ratio 0.5)", () => {
    expect(classifyTrend(1, 8, settings).status).toBe("slowing");
  });
  it("steady: 2 vs avg 2", () => {
    expect(classifyTrend(2, 8, settings).status).toBe("steady");
  });
  it("does not label anything when baseline has fewer than the minimum deals", () => {
    expect(classifyTrend(10, 2, settings).status).toBe("not_enough_history");
    expect(classifyTrend(0, 2, settings).status).toBe("not_enough_history");
  });
});

describe("isFocusDeal", () => {
  it("needs focus sector and a focus stage", () => {
    expect(isFocusDeal({ sector: "Fintech", stage: "Seed", matchTag: null }, mandate)).toBe(true);
    expect(isFocusDeal({ sector: "Climate & sustainability", stage: "Seed", matchTag: null }, mandate)).toBe(false);
    expect(isFocusDeal({ sector: "Fintech", stage: "Unknown", matchTag: null }, mandate)).toBe(false);
  });
  it("Series B+ only counts for Portfolio or On Radar companies", () => {
    expect(isFocusDeal({ sector: "Fintech", stage: "Series B+", matchTag: null }, mandate)).toBe(false);
    expect(isFocusDeal({ sector: "Fintech", stage: "Series B+", matchTag: "Portfolio" }, mandate)).toBe(true);
    expect(isFocusDeal({ sector: "Fintech", stage: "Series B+", matchTag: "On Radar" }, mandate)).toBe(true);
  });
});

describe("computeWeek", () => {
  const history = [
    // Fintech baseline: 2 + 2 + 2 + 2 = 8 deals, investors A and B seen
    ...["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].flatMap((w) => [
      deal({ weekStart: w, investors: [{ name: "Alpha Capital", role: "lead" }] }),
      deal({ weekStart: w, investors: [{ name: "Beta Ventures", role: "participant" }] }),
    ]),
    // Health baseline only 1 deal: not enough history
    deal({ weekStart: "2026-09-14", sector: "Health & wellness", investors: [{ name: "Gamma Fund", role: "lead" }] }),
  ];
  const thisWeek = [
    deal({ weekStart: W, amountUsd: 2_000_000, amountInr: 191_400_000, investors: [{ name: "Alpha Capital Pvt Ltd", role: "lead" }] }),
    deal({ weekStart: W, amountUsd: 3_000_000, amountInr: 287_100_000, investors: [{ name: "Delta Partners", role: "lead" }] }),
    deal({ weekStart: W, amountUsd: null, matchTag: "Portfolio", investors: [{ name: "Peak XV Partners", role: "lead" }] }),
    deal({ weekStart: W, amountUsd: 1_000_000, amountInr: 95_700_000, stage: "Series B+", matchTag: "On Radar" }),
    deal({ weekStart: W, amountUsd: 500_000, amountInr: 47_850_000, investors: [{ name: "Delta Partners", role: "participant" }] }),
    deal({ weekStart: W, sector: "Health & wellness", amountUsd: 9_000_000, amountInr: 861_300_000, investors: [{ name: "Zeta Fund", role: "lead" }] }),
  ];
  const r = computeWeek({ week: W, deals: [...history, ...thisWeek], sectors, settings, mandate, watchInvestors: ["Peak XV Partners"] });

  it("sums disclosed capital and never sums undisclosed deals", () => {
    const f = r.capital.find((c) => c.sector === "Fintech")!;
    expect(f.deals).toBe(5);
    expect(f.disclosedUsd).toBe(6_500_000);
    expect(f.disclosedCount).toBe(4);
    expect(f.undisclosed).toHaveLength(1);
  });
  it("ranks capital by disclosed amount and picks the top sector", () => {
    expect(r.capital[0].sector).toBe("Health & wellness");
    expect(r.kpis.topSector).toBe("Health & wellness");
    expect(r.kpis.deals).toBe(6);
    expect(r.kpis.disclosedUsd).toBe(15_500_000);
    expect(r.kpis.undisclosedCount).toBe(1);
  });
  it("labels Fintech accelerating: 5 deals vs average 2 (+3)", () => {
    const t = r.trends.find((x) => x.sector === "Fintech")!;
    expect(t.baselineAvg).toBe(2);
    expect(t.status).toBe("accelerating");
    expect(t.series).toHaveLength(5);
  });
  it("shows not enough history for Health (1 baseline deal)", () => {
    expect(r.trends.find((x) => x.sector === "Health & wellness")!.status).toBe("not_enough_history");
  });
  it("finds new investors only where history exists, ignoring legal suffixes", () => {
    const names = r.newInvestors.map((n) => n.investor);
    expect(names).toContain("Delta Partners");
    expect(names).toContain("Peak XV Partners");
    expect(names).not.toContain("Alpha Capital Pvt Ltd"); // Alpha seen before
    expect(names).not.toContain("Zeta Fund"); // Health has too little history
    expect(r.sectorsWithoutHistory).toContain("Health & wellness");
    expect(r.newInvestors.find((n) => n.investor === "Peak XV Partners")!.onWatchlist).toBe(true);
    expect(r.newInvestors.find((n) => n.investor === "Delta Partners")!.dealIds).toHaveLength(2);
    expect(r.kpis.newInvestors).toBe(2);
  });
  it("counts watchlist hits and focus deals", () => {
    expect(r.kpis.watchlistHits).toBe(2);
    // Fintech Seed deals (4) plus the Series B+ one tagged On Radar (1) plus the Health seed deal (1)
    expect(r.focusDealIds).toHaveLength(6);
  });
  it("does not call the catch-all Other bucket the top sector when a named sector has deals", () => {
    const deals = [
      deal({ weekStart: W, sector: "Other", amountUsd: 900_000_000, amountInr: 1, investors: [] }),
      deal({ weekStart: W, sector: "Fintech", amountUsd: 1_000_000, amountInr: 1, investors: [] }),
    ];
    const r2 = computeWeek({ week: W, deals, sectors, settings, mandate, watchInvestors: [] });
    expect(r2.kpis.topSector).toBe("Fintech");
  });
});

describe("quality rules found on real data", () => {
  const hist = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].flatMap((w) => [deal({ weekStart: w }), deal({ weekStart: w })]);
  it("a near-miss match (needs review) is not counted as a watchlist hit", () => {
    const deals = [...hist, deal({ weekStart: W, matchTag: "Portfolio", needsReview: true }), deal({ weekStart: W, matchTag: "Portfolio", needsReview: false })];
    const r = computeWeek({ week: W, deals, sectors, settings, mandate, watchInvestors: [] });
    expect(r.kpis.watchlistHits).toBe(1);
    expect(r.kpis.needsReview).toBe(1);
  });
  it("placeholder investor names are not named new investors", () => {
    const deals = [...hist, deal({ weekStart: W, investors: [{ name: "Existing investors", role: "participant" }, { name: "Angel investors", role: "participant" }, { name: "Real Capital", role: "lead" }] })];
    const r = computeWeek({ week: W, deals, sectors, settings, mandate, watchInvestors: [] });
    expect(r.newInvestors.map((n) => n.investor)).toEqual(["Real Capital"]);
  });
  it("new investors are only reported for the target (focus) sectors", () => {
    const other = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].flatMap((w) => [deal({ weekStart: w, sector: "Other" }), deal({ weekStart: w, sector: "Other" })]);
    const deals = [...other, deal({ weekStart: W, sector: "Other", investors: [{ name: "Fresh Fund", role: "lead" }] })];
    const r = computeWeek({ week: W, deals, sectors, settings, mandate, watchInvestors: [] });
    expect(r.newInvestors).toHaveLength(0);
  });
});
