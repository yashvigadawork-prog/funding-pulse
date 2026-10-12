import { describe, expect, it } from "vitest";
import { adjacencyWindow, computeAdjacency, describeGroup, meaningfulTerms, sharedTerms, type AdjacencyDeal, type AdjacencyPortfolio } from "./adjacency";

const settings = { adjacency_window_days: 10, adjacency_min_shared_terms: 2, adjacency_cluster_min_companies: 2 };
const portfolio: AdjacencyPortfolio[] = [
  { id: "p1", name: "Wealthify", sector: "Fintech", description: "Technology infrastructure for wealth managers and portfolio advisory with multi-portfolio research" },
  { id: "p2", name: "GreenCell", sector: "Climate & sustainability", description: "Battery recycling for electric vehicles" },
];
const src = [{ url: "https://ex.com/a", outlet: "Ex" }];
let n = 0;
const deal = (o: Partial<AdjacencyDeal>): AdjacencyDeal => ({
  id: ++n,
  companyName: `Co${n}`,
  matchTag: null,
  sector: "Fintech",
  stage: "Seed",
  amountText: "$2 million",
  announcedOn: "2026-10-08",
  summary: "Platform for wealth managers offering portfolio advisory tools",
  sources: src,
  ...o,
});
const base = { portfolio, weekStart: "2026-10-05", today: "2026-10-20", settings };

describe("meaningfulTerms", () => {
  it("drops stopwords, generic words, short words and the sector's own name, and trims plurals", () => {
    const t = meaningfulTerms("A fintech startup in India that raises funding for lending platforms and wealth managers");
    expect([...t].sort()).toEqual(["lending", "manager", "wealth"]);
  });
  it("shares terms case-insensitively", () => {
    expect(sharedTerms("Wealth Managers advisory", "advisory for wealth manager groups")).toEqual(["advisory", "manager", "wealth"]);
  });
});

describe("adjacencyWindow", () => {
  it("ends on the last day of a past week", () => {
    expect(adjacencyWindow("2026-10-05", "2026-10-20", 10)).toEqual({ from: "2026-10-02", to: "2026-10-11" });
  });
  it("ends today for the current week", () => {
    expect(adjacencyWindow("2026-10-12", "2026-10-14", 10)).toEqual({ from: "2026-10-05", to: "2026-10-14" });
  });
});

describe("computeAdjacency", () => {
  it("booklet scenario: two different companies near a portfolio company within 10 days make a cluster", () => {
    const g = computeAdjacency({ ...base, deals: [deal({ companyName: "AlphaWealth", announcedOn: "2026-10-03" }), deal({ companyName: "BetaAdvisory", announcedOn: "2026-10-10" })] });
    expect(g).toHaveLength(1);
    expect(g[0].portfolioName).toBe("Wealthify");
    expect(g[0].cluster).toBe(true);
    expect(g[0].companies).toBe(2);
    expect(g[0].items[0].sharedTerms.length).toBeGreaterThanOrEqual(2);
    expect(g[0].items[0].sources).toEqual(src);
    expect(describeGroup(g[0])).toContain("2 companies in the same space raised within 10 days");
  });
  it("one adjacent company is not a cluster", () => {
    const g = computeAdjacency({ ...base, deals: [deal({ companyName: "AlphaWealth" })] });
    expect(g[0].cluster).toBe(false);
    expect(describeGroup(g[0])).toMatch(/^Near Wealthify: shares /);
  });
  it("same sector but unrelated descriptions is not adjacent", () => {
    expect(computeAdjacency({ ...base, deals: [deal({ summary: "Consumer credit cards for students" })] })).toHaveLength(0);
  });
  it("a deal outside the window is excluded", () => {
    expect(computeAdjacency({ ...base, deals: [deal({ announcedOn: "2026-09-20" }), deal({ announcedOn: "2026-10-15" })] })).toHaveLength(0);
  });
  it("a deal whose own company is a Portfolio company is Direct, not Adjacent", () => {
    expect(computeAdjacency({ ...base, deals: [deal({ companyName: "Wealthify", matchTag: "Portfolio" })] })).toHaveLength(0);
  });
  it("On Radar companies can be adjacent", () => {
    const g = computeAdjacency({ ...base, deals: [deal({ matchTag: "On Radar" })] });
    expect(g).toHaveLength(1);
  });
  it("below-threshold shared terms are not adjacent", () => {
    expect(computeAdjacency({ ...base, deals: [deal({ summary: "Tools for wealth planning" })] })).toHaveLength(0);
    expect(computeAdjacency({ ...base, settings: { ...settings, adjacency_min_shared_terms: 1 }, deals: [deal({ summary: "Tools for wealth planning" })] })).toHaveLength(1);
  });
  it("a different sector is never adjacent", () => {
    expect(computeAdjacency({ ...base, deals: [deal({ sector: "Health & wellness" })] })).toHaveLength(0);
  });
  it("orders clusters first, then by number of items", () => {
    const g = computeAdjacency({
      ...base,
      deals: [
        deal({ companyName: "A", sector: "Climate & sustainability", summary: "Battery recycling for electric vehicles", announcedOn: "2026-10-10" }),
        deal({ companyName: "B", announcedOn: "2026-10-04" }),
        deal({ companyName: "C", announcedOn: "2026-10-05" }),
      ],
    });
    expect(g.map((x) => x.portfolioName)).toEqual(["Wealthify", "GreenCell"]);
  });
});
