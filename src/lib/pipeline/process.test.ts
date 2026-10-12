import { describe, expect, it } from "vitest";
import { normaliseExtracted } from "./process";
import { extractedDealSchema } from "./extract";

const taxonomy = { sectors: { Fintech: ["upi"], Other: [] }, stages: ["Pre-seed", "Seed", "Series A", "Unknown"] };
const fund = { usd_inr_rate: 90 } as never;
const deal = (extra: object = {}) => extractedDealSchema.parse({ company_name: "Zomint", stage: "Seed", amount_text: "$2 million", sector: "Fintech", ...extra });

describe("normaliseExtracted", () => {
  it("marks a deal low confidence when neither the text nor the article has a date", () => {
    const d = normaliseExtracted(deal(), { id: 1, publishedAt: null, title: "x", kind: "article" }, { taxonomy, fund_profile: fund });
    expect(d.confidence).toBe("low");
  });
  it("keeps medium confidence when the article is dated or the text states a date", () => {
    const dated = normaliseExtracted(deal(), { id: 1, publishedAt: new Date("2026-10-06T08:00:00Z"), title: "x", kind: "article" }, { taxonomy, fund_profile: fund });
    expect(dated.confidence).toBe("medium");
    const stated = normaliseExtracted(deal({ announced_on: "2026-10-06" }), { id: 1, publishedAt: null, title: "x", kind: "article" }, { taxonomy, fund_profile: fund });
    expect(stated.confidence).toBe("medium");
  });
});
