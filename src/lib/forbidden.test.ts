import { describe, expect, it } from "vitest";
import { containsForbidden, FORBIDDEN_WORDS, REPLACEMENT, scrubDeep, scrubText, visibleInvestors, visibleNames } from "./forbidden";

const a = ["Rain", "matter"].join("");
const z = ["Zero", "dha"].join("");

describe("forbidden name filter", () => {
  it("drops forbidden investors from a list and keeps the rest in order", () => {
    const list = [{ name: "Chiratae Ventures", role: "lead" }, { name: a, role: "participant" }, { name: `${a} by ${z}`, role: "participant" }, { name: "Pi Ventures", role: "participant" }];
    expect(visibleInvestors(list).map((i) => i.name)).toEqual(["Chiratae Ventures", "Pi Ventures"]);
    expect(visibleNames(["A", a.toLowerCase(), z.toUpperCase(), "B"])).toEqual(["A", "B"]);
  });
  it("matches in any case and inside longer names", () => {
    expect(containsForbidden(`${a.toUpperCase()} Capital`)).toBe(true);
    expect(containsForbidden("Peak XV Partners")).toBe(false);
    expect(containsForbidden(null)).toBe(false);
  });
  it("replaces the names in free text, treating 'X by Y' as one phrase", () => {
    expect(scrubText(`Led by Chiratae and ${a} by ${z}.`)).toBe(`Led by Chiratae and ${REPLACEMENT}.`);
    expect(scrubText(`${z}-backed fund`)).toBe(`${REPLACEMENT}-backed fund`);
    expect(scrubText("Nothing to hide here")).toBe("Nothing to hide here");
  });
  it("scrubs nested data without touching numbers, nulls or dates", () => {
    const d = new Date("2026-10-05");
    const out = scrubDeep({ why: `With ${a}`, list: [{ n: z }], count: 3, none: null, when: d });
    expect(JSON.stringify(out)).not.toMatch(new RegExp(FORBIDDEN_WORDS.join("|"), "i"));
    expect(out.count).toBe(3);
    expect(out.none).toBeNull();
    expect(out.when).toBe(d);
  });
});
