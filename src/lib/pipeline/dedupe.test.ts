import { describe, expect, it } from "vitest";
import { dedupeDeals, sameRound, type DealLike } from "./dedupe";

const base: DealLike = {
  companyName: "Zomint",
  domain: null,
  stage: "Seed",
  sector: "Fintech",
  announcedOn: "2026-10-06",
  amountUsd: 2_000_000,
  amountInr: 191_400_000,
  amountMinUsd: null,
  amountMaxUsd: null,
  amountText: "$2 million",
  summary: "Wealth app",
  founders: [],
  investors: [{ name: "Peak XV Partners", role: "lead" }],
  articleIds: [1],
  confidence: "medium",
};
const d = (o: Partial<DealLike>): DealLike => ({ ...base, ...o });

describe("sameRound", () => {
  it("matches the same company, stage and near dates", () => {
    expect(sameRound(base, d({ companyName: "ZOMINT Pvt Ltd", announcedOn: "2026-10-12" }))).toBe(true);
  });
  it("does not merge dates more than 14 days apart", () => {
    expect(sameRound(base, d({ announcedOn: "2026-10-25" }))).toBe(false);
  });
  it("does not merge different known stages", () => {
    expect(sameRound(base, d({ stage: "Series A" }))).toBe(false);
  });
  it("treats an Unknown stage as compatible", () => {
    expect(sameRound(base, d({ stage: "Unknown" }))).toBe(true);
  });
});

describe("dedupeDeals", () => {
  it("merges two outlets into one deal and keeps both sources and all investors", () => {
    const out = dedupeDeals([
      base,
      d({ articleIds: [2], investors: [{ name: "Elevation Capital", role: "participant" }], announcedOn: "2026-10-07" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].articleIds.sort()).toEqual([1, 2]);
    expect(out[0].investors.map((i) => i.name).sort()).toEqual(["Elevation Capital", "Peak XV Partners"]);
    expect(out[0].confidence).toBe("high");
    expect(out[0].announcedOn).toBe("2026-10-06");
  });

  it("keeps a range and lowers confidence when amounts disagree", () => {
    const out = dedupeDeals([base, d({ articleIds: [2], amountUsd: 3_000_000, amountInr: 287_100_000, amountText: "$3 million" })]);
    expect(out).toHaveLength(1);
    expect(out[0].amountMinUsd).toBe(2_000_000);
    expect(out[0].amountMaxUsd).toBe(3_000_000);
    expect(out[0].confidence).toBe("low");
    expect(out[0].amountText).toContain("$2 million");
    expect(out[0].amountText).toContain("$3 million");
  });

  it("takes the disclosed amount when the other outlet did not give one", () => {
    const out = dedupeDeals([base, d({ articleIds: [2], amountUsd: null, amountInr: null, amountText: "Undisclosed" })]);
    expect(out[0].amountUsd).toBe(2_000_000);
    expect(out[0].amountMinUsd).toBeNull();
    expect(out[0].confidence).toBe("high");
  });

  it("keeps different companies apart", () => {
    expect(dedupeDeals([base, d({ companyName: "Other Co" })])).toHaveLength(2);
  });

  it("is not affected by input order", () => {
    const a = dedupeDeals([base, d({ articleIds: [2], announcedOn: "2026-10-08" })]);
    const b = dedupeDeals([d({ articleIds: [2], announcedOn: "2026-10-08" }), base]);
    expect(a[0].articleIds.sort()).toEqual(b[0].articleIds.sort());
  });
});

describe("same round under two names", () => {
  it("merges a brand and its parent when amount and an investor match", () => {
    const a = d({ companyName: "myTVS", investors: [{ name: "CE-I", role: "lead" }], amountUsd: 44_400_000 });
    const b = d({ companyName: "TVS Automobile Solutions", investors: [{ name: "CE-I", role: "lead" }], amountUsd: 44_100_000, articleIds: [2] });
    expect(dedupeDeals([a, b])).toHaveLength(1);
  });
  it("does not merge on amount alone", () => {
    const a = d({ companyName: "A Co", investors: [{ name: "X", role: "lead" }], amountUsd: 5_000_000 });
    const b = d({ companyName: "B Co", investors: [{ name: "Y", role: "lead" }], amountUsd: 5_000_000 });
    expect(dedupeDeals([a, b])).toHaveLength(2);
  });
  it("does not merge undisclosed amounts", () => {
    const a = d({ companyName: "A Co", investors: [{ name: "X", role: "lead" }], amountUsd: null });
    const b = d({ companyName: "B Co", investors: [{ name: "X", role: "lead" }], amountUsd: null });
    expect(dedupeDeals([a, b])).toHaveLength(2);
  });
});

describe("joinAmountTexts", () => {
  it("keeps one wording per distinct amount", async () => {
    const { joinAmountTexts } = await import("./dedupe");
    expect(joinAmountTexts(["$1.3 Mn", "$1.3 million / $1.3 Mn"])).toBe("$1.3 Mn");
    expect(joinAmountTexts(["$2 million", "$3 million"])).toBe("$2 million / $3 million");
    expect(joinAmountTexts([null, "Undisclosed", "undisclosed"])).toBe("Undisclosed");
  });
});
