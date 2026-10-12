import { describe, expect, it } from "vitest";
import { questionTerms, rankByQuestion, type AskDeal } from "./ask-rank";

const d = (o: Partial<AskDeal>): AskDeal => ({ id: 1, company: "Zomint", sector: "Fintech", stage: "Seed", amountText: "$2M", date: "2026-10-06", tag: null, summary: "Wealth app", investors: ["Peak XV Partners"], sources: [], ...o });

describe("ask retrieval", () => {
  it("drops filler words", () => {
    expect(questionTerms("What did Peak XV invest in last week?")).toEqual(["peak", "invest"]);
  });
  it("ranks a company-name hit above a sector-only hit", () => {
    const r = rankByQuestion("Tell me about Zomint", [d({ id: 1, company: "Other", summary: "zomint rival" }), d({ id: 2 })], 5);
    expect(r[0].id).toBe(2);
  });
  it("matches investors", () => {
    expect(rankByQuestion("what did Peak XV back", [d({ id: 1 }), d({ id: 2, investors: ["Elevation"] })], 5).map((x) => x.id)).toEqual([1]);
  });
  it("returns nothing when no stored deal matches", () => {
    expect(rankByQuestion("quantum computing in Mars", [d({})], 5)).toEqual([]);
  });
});
