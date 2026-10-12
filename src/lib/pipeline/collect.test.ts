import { describe, expect, it } from "vitest";
import { buildGapQueries } from "./collect";
import type { CompanyJson, Mandate, Sources } from "@/lib/config/schema";

const mandate = { focus_sectors: ["Fintech", "Health & wellness"], other_sectors_to_note: true, stages: [], geography: "India", ticket_size_usd: { min: null, max: null } } as unknown as Mandate;
const radar = [
  { id: "a", name: "LowCo", priority: "low" },
  { id: "b", name: "HighCo", priority: "high" },
  { id: "c", name: "MidCo", priority: "medium" },
] as unknown as CompanyJson[];
const linkedin: Sources["linkedin_via_search"] = {
  enabled: true,
  include_domain: "linkedin.com",
  query_templates: ["{investor} announces investment in {sector} startup", "{company} raises funding"],
};

describe("buildGapQueries", () => {
  it("starts with sector queries then On Radar by priority, within the cap", () => {
    const q = buildGapQueries({ mandate, onRadar: radar, investors: [{ name: "Inv One", note: null }], linkedin, maxQueries: 10 });
    expect(q.length).toBeLessThanOrEqual(10);
    expect(q[0].purpose).toBe("sector");
    const radarQs = q.filter((x) => x.purpose === "radar");
    expect(radarQs[0].query).toContain("HighCo");
    expect(q.some((x) => x.purpose === "linkedin" && x.includeDomains?.[0] === "linkedin.com")).toBe(true);
  });
  it("covers unreachable outlets through a search limited to their own site, within a share of the cap", () => {
    const outlets = ["A", "B", "C", "D", "E", "F", "G", "H"].map((n) => ({ outlet: n, site: `${n.toLowerCase()}.com` }));
    const q = buildGapQueries({ mandate, onRadar: radar, investors: [], linkedin, maxQueries: 20, outlets });
    const o = q.filter((x) => x.purpose === "outlet");
    expect(o).toHaveLength(5);
    expect(o[0].includeDomains).toEqual(["a.com"]);
    expect(q.length).toBeLessThanOrEqual(20);
  });
  it("skips LinkedIn queries when switched off", () => {
    const q = buildGapQueries({ mandate, onRadar: radar, investors: [], linkedin: { ...linkedin, enabled: false }, maxQueries: 10 });
    expect(q.some((x) => x.purpose === "linkedin")).toBe(false);
  });
  it("respects a zero cap", () => {
    expect(buildGapQueries({ mandate, onRadar: radar, investors: [], linkedin, maxQueries: 0 })).toHaveLength(0);
  });
});
