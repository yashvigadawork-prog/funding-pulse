import { describe, expect, it } from "vitest";
import { mapSectorByKeywords, normaliseStage, resolveAmount, resolveSector } from "./normalise";
import { parseAmountText } from "@/lib/money";

const sectors: Record<string, string[]> = {
  Fintech: ["fintech", "payments", "lending", "insurance"],
  "Health & wellness": ["health", "wellness", "diagnostics"],
  "Climate & sustainability": ["climate", "solar", "ev", "battery"],
  "Media, deeptech & education": ["deeptech", "edtech", "space"],
  Other: [],
};
const stages = ["Pre-seed", "Seed", "Pre-Series A", "Series A", "Series B+", "Debt", "Unknown"];

describe("sector keywords", () => {
  it("matches whole words only: ev must not match even or development", () => {
    expect(mapSectorByKeywords("Even as development continued, nothing happened", sectors)).toBeNull();
    expect(mapSectorByKeywords("An EV charging startup", sectors)).toBe("Climate & sustainability");
  });
  it("picks the sector with the most keyword hits", () => {
    expect(mapSectorByKeywords("A payments and lending platform for solar installers", sectors)).toBe("Fintech");
  });
  it("uses Gemini's sector when it is in the list, ignoring case", () => {
    expect(resolveSector("fintech", "solar", sectors)).toBe("Fintech");
  });
  it("falls back to keywords when Gemini's sector is outside the list or missing", () => {
    expect(resolveSector("Consumer", "a battery maker", sectors)).toBe("Climate & sustainability");
    expect(resolveSector(null, "a battery maker", sectors)).toBe("Climate & sustainability");
  });
  it("falls back to Other when nothing matches", () => {
    expect(resolveSector(null, "a bakery chain", sectors)).toBe("Other");
  });
});

describe("normaliseStage", () => {
  it.each([
    ["pre-seed", "Pre-seed"],
    ["Pre Seed", "Pre-seed"],
    ["Seed round", "Seed"],
    ["pre-Series A", "Pre-Series A"],
    ["Series A", "Series A"],
    ["Series A1", "Series A"],
    ["Series B", "Series B+"],
    ["series C", "Series B+"],
    ["Pre-IPO", "Series B+"],
    ["venture debt", "Debt"],
    ["bridge round", "Unknown"],
    [null, "Unknown"],
  ])("%s -> %s", (raw, out) => expect(normaliseStage(raw as string | null, stages)).toBe(out));
});

describe("amounts", () => {
  it("parses common formats", () => {
    expect(parseAmountText("$5 million")?.base).toBe(5_000_000);
    expect(parseAmountText("Rs 40 crore")?.base).toBe(400_000_000);
    expect(parseAmountText("₹2.5 Cr")?.base).toBe(25_000_000);
    expect(parseAmountText("INR 12 crore")?.currency).toBe("INR");
    expect(parseAmountText("US$ 3M")?.base).toBe(3_000_000);
    expect(parseAmountText("$1,500,000")?.base).toBe(1_500_000);
    expect(parseAmountText("Rs 75 lakh")?.base).toBe(7_500_000);
  });
  it("keeps undisclosed as null", () => {
    expect(parseAmountText("Undisclosed")).toBeNull();
    expect(parseAmountText(null)).toBeNull();
    expect(parseAmountText("an undisclosed amount")).toBeNull();
  });
  it("converts with the configured rate", () => {
    const r = resolveAmount({ amountText: "$2 million", value: null, unit: null, currency: null }, 95.7);
    expect(r.usd).toBe(2_000_000);
    expect(r.inr).toBeCloseTo(191_400_000);
    const r2 = resolveAmount({ amountText: "Rs 957 crore", value: null, unit: null, currency: null }, 95.7);
    expect(r2.usd).toBeCloseTo(100_000_000);
  });
  it("falls back to structured fields, and to null", () => {
    expect(resolveAmount({ amountText: "a fresh round", value: 3, unit: "million", currency: "USD" }, 100).usd).toBe(3_000_000);
    expect(resolveAmount({ amountText: "undisclosed", value: null, unit: null, currency: null }, 100)).toEqual({ usd: null, inr: null });
  });
});
