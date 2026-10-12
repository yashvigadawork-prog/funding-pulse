import { describe, expect, it } from "vitest";
import { brevityProblem, numbersAreGrounded, scoreDeal, selectCandidates, templateAnalysis, wordCount, type DealView } from "./analyse";
import { computeWeek } from "./compute";
import type { Mandate } from "@/lib/config/schema";

const mandate: Mandate = {
  geography: "India",
  focus_sectors: ["Fintech"],
  other_sectors_to_note: true,
  stages: [{ name: "Seed", focus: true, follow_on_only: false }],
  ticket_size_usd: { min: null, max: null },
};
const settings = { baseline_weeks: 4, acceleration_ratio: 1.25, slowing_ratio: 0.75, min_baseline_deals: 3, min_extra_deals: 2 };
const mk = (id: number, o: Partial<DealView> = {}): DealView => ({
  id,
  companyName: `Co${id}`,
  companyId: null,
  matchTag: null,
  needsReview: false,
  sector: "Fintech",
  stage: "Seed",
  amountUsd: 2_000_000,
  amountInr: 191_400_000,
  announcedOn: "2026-10-06",
  weekStart: "2026-10-05",
  investors: [],
  amountText: "$2 million",
  summary: "x",
  confidence: "medium",
  sources: [{ n: id, url: `https://ex.com/${id}`, outlet: "Ex", title: "t" }],
  domain: null,
  founders: [],
  excerpt: "text",
  novel: false,
  ...o,
});

describe("numbersAreGrounded", () => {
  const blob = `{"disclosed_capital":"$12.5M","deals":7,"avg":2.25}`;
  it("accepts numbers that appear in the data and small counts", () => {
    expect(numbersAreGrounded("Fintech raised $12.5M across 7 deals, avg 2.25. Three of 9 were large.", blob).ok).toBe(true);
  });
  it("rejects invented numbers", () => {
    const r = numbersAreGrounded("That is a 38% jump to $19.4M", blob);
    expect(r.ok).toBe(false);
    expect(r.bad).toContain("38");
    expect(r.bad).toContain("19.4");
  });
});

describe("highlight scoring", () => {
  const ctx = { mandate, newInvestorDealIds: new Set<number>(), watchInvestorDealIds: new Set<number>() };
  it("ranks a watchlist focus deal above a plain one", () => {
    expect(scoreDeal(mk(1, { matchTag: "On Radar" }), ctx).score).toBeGreaterThan(scoreDeal(mk(2), ctx).score);
  });
  it("gives a reason for every point scored", () => {
    expect(scoreDeal(mk(1, { matchTag: "Portfolio", amountUsd: 12e6 }), ctx).reasons.length).toBeGreaterThanOrEqual(3);
  });
  it("selects at most the requested total", () => {
    const deals = Array.from({ length: 20 }, (_, i) => mk(i + 1));
    const compute = computeWeek({ week: "2026-10-05", deals, sectors: ["Fintech"], settings, mandate, watchInvestors: [] });
    expect(selectCandidates(deals, compute, mandate, new Set(), 15)).toHaveLength(15);
  });
});

describe("templateAnalysis", () => {
  it("builds cited text from the numbers alone", () => {
    const deals = [mk(1), mk(2), mk(3, { amountUsd: null, amountInr: null })];
    const compute = computeWeek({ week: "2026-10-05", deals, sectors: ["Fintech"], settings, mandate, watchInvestors: [] });
    const a = templateAnalysis({ week: "2026-10-05", compute, deals, candidates: [], mandate });
    expect(a.source).toBe("template");
    expect(a.reason).toBe("history");
    expect(templateAnalysis({ week: "2026-10-05", compute, deals, candidates: [], mandate }, "x", "ai_unavailable").reason).toBe("ai_unavailable");
    expect(a.capital.summary).toContain("Fintech");
    expect(a.capital.points.every((p) => p.sources.length > 0)).toBe(true);
    expect(a.momentum.summary.length).toBeGreaterThan(0);
  });
});

describe("short forms stay short", () => {
  const blk = (headline: string, bullet: string) => ({ headline, bullets: [{ label: "Reported" as const, text: bullet, source_ids: [1] }], detail: "x", points: [] });
  const ok = { week_line: "Deeptech led a busy week with the biggest cheques.", week_bullets: ["Fintech is busy again."], capital: blk("Deeptech led the week.", "Fintech raised the most."), momentum: blk("Fintech is speeding up.", "Seven deals against one usual."), new_investors: blk("Three new names.", "A new fund backed Fintech.") };
  it("counts words", () => expect(wordCount("  one two   three ")).toBe(3));
  it("accepts short text", () => expect(brevityProblem(ok)).toBeNull());
  it("rejects a long week line", () => expect(brevityProblem({ ...ok, week_line: "word ".repeat(30) })).toMatch(/week_line/));
  it("rejects a long headline or bullet", () => {
    expect(brevityProblem({ ...ok, capital: blk("word ".repeat(25), "short") })).toMatch(/capital headline/);
    expect(brevityProblem({ ...ok, momentum: blk("short", "word ".repeat(25)) })).toMatch(/momentum bullet/);
  });
  it("the template fallback also fills the short forms with cited bullets", () => {
    const deals = [mk(1), mk(2)];
    const compute = computeWeek({ week: "2026-10-05", deals, sectors: ["Fintech"], settings, mandate, watchInvestors: [] });
    const a = templateAnalysis({ week: "2026-10-05", compute, deals, candidates: [], mandate });
    expect(a.weekLine).toBeTruthy();
    expect(a.weekBullets).toHaveLength(3);
    expect(a.capital.headline).toBeTruthy();
    expect(a.capital.bullets?.every((b) => b.sources.length > 0)).toBe(true);
  });
});
