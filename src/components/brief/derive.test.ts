import { describe, expect, it } from "vitest";
import { firstSentence, weekBullets, weekHeadline } from "./derive";
import { parseTab } from "@/components/dashboard/nav";
import type { DigestView } from "@/lib/view-types";

const block = (summary: string, headline?: string) => ({ summary, points: [], headline });
const view = (over: Record<string, unknown> = {}, kpi: Record<string, unknown> = {}): DigestView =>
  ({
    digest: {
      kpis: { deals: 12, topSector: "Fintech", topSectorUsd: 5_000_000, ...kpi },
      patterns: { computed: { capital: [{ sector: "Fintech", deals: 4 }] } },
      analysis: { capital: block("Capital came mostly from fintech. More detail follows."), momentum: block("Activity is up."), new_investors: block("Two new names appeared."), ...over },
    },
  }) as unknown as DigestView;

describe("hero text", () => {
  it("uses the AI's one-line headline when it exists", () => {
    expect(weekHeadline(view({ weekLine: "Fintech led a busy week." }))).toBe("Fintech led a busy week.");
  });
  it("builds a sentence from the computed numbers when it does not", () => {
    expect(weekHeadline(view())).toBe("Fintech drew the most money this week: $5M across 4 deals.");
    expect(weekHeadline(view({}, { deals: 0, topSector: null, topSectorUsd: null }))).toBe("No funding deals were recorded this week.");
  });
  it("uses the three week bullets, or the first sentence of each answer", () => {
    expect(weekBullets(view({ weekBullets: [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d" }] }))).toEqual(["a", "b", "c"]);
    expect(weekBullets(view())).toEqual(["Capital came mostly from fintech.", "Activity is up.", "Two new names appeared."]);
  });
  it("shortens long sentences with an ellipsis", () => {
    expect(firstSentence("x".repeat(200), 50).length).toBe(50);
    expect(firstSentence("x".repeat(200), 50).endsWith("…")).toBe(true);
  });
});

describe("tabs in the URL", () => {
  it("accepts the three tabs and falls back to Brief", () => {
    expect(parseTab("market")).toBe("market");
    expect(parseTab("actions")).toBe("actions");
    expect(parseTab("brief")).toBe("brief");
    expect(parseTab(null)).toBe("brief");
    expect(parseTab("nonsense")).toBe("brief");
  });
});
