import { describe, expect, it } from "vitest";
import { findMentions, jaroWinkler, matchCompany, normalizeName, type MatchCandidate } from "./index";

const c = (
  id: string,
  name: string,
  tag: "Portfolio" | "On Radar",
  aliases: string[] = [],
  ctx: string[] = [],
): MatchCandidate => ({ id, name, tag, aliases, matchRequiresContext: ctx });

const candidates: MatchCandidate[] = [
  c("jupiter", "Jupiter", "Portfolio", ["Jupiter Money"], ["neobank", "banking", "fintech", "money app"]),
  c("even", "Even", "Portfolio", ["Even Healthcare"], ["healthcare", "health plan", "insurance"]),
  c("fold", "Fold", "Portfolio", ["Fold Money"], ["fintech", "bitcoin", "investing", "personal finance"]),
  c("zomint", "Zomint", "On Radar"),
  c("ultrahuman", "Ultrahuman", "Portfolio"),
  c("sarvam", "Sarvam AI", "On Radar"),
];
const opts = { fuzzyThreshold: 0.85 };

describe("normalizeName", () => {
  it("lowercases, strips punctuation and legal suffixes", () => {
    expect(normalizeName("Zomint Pvt. Ltd.")).toBe("zomint");
    expect(normalizeName("Acme Private Limited")).toBe("acme");
    expect(normalizeName("Sarvam.AI")).toBe("sarvam ai");
  });
});

describe("matchCompany", () => {
  it("matches exact names ignoring case, punctuation and legal suffixes", () => {
    const r = matchCompany({ name: "ZOMINT Pvt Ltd" }, candidates, opts);
    expect(r.company?.id).toBe("zomint");
    expect(r.kind).toBe("exact");
    expect(r.needsReview).toBe(false);
  });

  it("matches by alias", () => {
    const r = matchCompany({ name: "Jupiter Money", context: "Jupiter Money, a neobank, raised funding" }, candidates, opts);
    expect(r.company?.id).toBe("jupiter");
    expect(r.kind).toBe("alias");
  });

  it("Jupiter the neobank matches because a context word is nearby", () => {
    const r = matchCompany(
      { name: "Jupiter", context: "Jupiter, the neobank backed by Peak XV, raised a new round." },
      candidates,
      opts,
    );
    expect(r.company?.id).toBe("jupiter");
    expect(r.reason).toContain("neobank");
  });

  it("Jupiter the solar maker does NOT match the neobank", () => {
    const r = matchCompany(
      { name: "Jupiter", context: "Jupiter, a rooftop solar panel maker based in Pune, raised $2 million." },
      candidates,
      opts,
    );
    expect(r.company).toBeNull();
    expect(r.reason).toContain("context");
  });

  it("Jupiter with no context text is not matched", () => {
    expect(matchCompany({ name: "Jupiter" }, candidates, opts).company).toBeNull();
  });

  it("Even the health insurer matches with a context word", () => {
    const r = matchCompany(
      { name: "Even Healthcare", context: "Even Healthcare, a health plan for families, raised a Series A." },
      candidates,
      opts,
    );
    expect(r.company?.id).toBe("even");
  });

  it("Even as an ordinary word does not match", () => {
    const r = matchCompany(
      { name: "Even", context: "Even as markets cooled, an electric scooter startup called Even raised seed money." },
      candidates,
      opts,
    );
    expect(r.company).toBeNull();
  });

  it("a context word far from the name does not count", () => {
    const filler = "x ".repeat(300);
    const r = matchCompany({ name: "Fold", context: `Fold makes paper tools. ${filler} unrelated bitcoin news` }, candidates, opts);
    expect(r.company).toBeNull();
  });

  it("flags a close spelling for review", () => {
    const r = matchCompany({ name: "Ultrahumann" }, candidates, opts);
    expect(r.company?.id).toBe("ultrahuman");
    expect(r.kind).toBe("fuzzy");
    expect(r.needsReview).toBe(true);
  });

  it("a name that contains the tracked name plus generic words is not sent to review", () => {
    const r = matchCompany({ name: "Zomint Technologies" }, candidates, opts);
    expect(r.company?.id).toBe("zomint");
    expect(r.needsReview).toBe(false);
  });

  it("does not match unrelated names", () => {
    expect(matchCompany({ name: "Bluestone Labs" }, candidates, opts).company).toBeNull();
  });

  it("respects a higher fuzzy threshold", () => {
    expect(matchCompany({ name: "Ultrahumann" }, candidates, { fuzzyThreshold: 0.999 }).company).toBeNull();
  });
});

describe("findMentions", () => {
  it("finds tracked names on word boundaries only", () => {
    const text = "Zomint raised money. Even as rates fell, Ultrahumans were cheered.";
    const hits = findMentions(text, candidates).map((h) => h.company.id);
    expect(hits).toContain("zomint");
    expect(hits).not.toContain("even");
    expect(hits).not.toContain("ultrahuman");
  });
});

describe("jaroWinkler", () => {
  it("is 1 for identical strings and low for unrelated ones", () => {
    expect(jaroWinkler("abc", "abc")).toBe(1);
    expect(jaroWinkler("abcdef", "uvwxyz")).toBeLessThan(0.5);
  });
});
