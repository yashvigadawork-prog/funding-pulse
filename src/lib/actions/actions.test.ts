import { describe, expect, it } from "vitest";
import { extractEmails, isLinkedInProfile, nameAppears } from "./contacts";
import { founderEmailDraft, linkedinNoteDraft, lpBriefDraft, lpBullets, portfolioFollowUpDraft } from "./drafts";

const sender = { name: "Aarav", title: "Venture Scout", organisation: "Cloudburst Ventures", intro_line: "I'm a venture scout at Cloudburst Ventures, a Bengaluru-based family office backing early-stage Indian startups.", outreach_tone: "warm" };

describe("contacts helpers", () => {
  it("only returns emails that are written on the page and belong to the company domain", () => {
    const html = `<a href="mailto:hello@zomint.com">Write</a> press@other.com logo@2x.png support@mail.zomint.com`;
    expect(extractEmails(html, "zomint.com").sort()).toEqual(["hello@zomint.com", "support@mail.zomint.com"]);
  });
  it("never invents an address when none is on the page", () => {
    expect(extractEmails("<p>No contact here</p>", "zomint.com")).toEqual([]);
  });
  it("recognises LinkedIn profile links only", () => {
    expect(isLinkedInProfile("https://www.linkedin.com/in/some-person-123")).toBe(true);
    expect(isLinkedInProfile("https://in.linkedin.com/in/some-person")).toBe(true);
    expect(isLinkedInProfile("https://www.linkedin.com/company/zomint")).toBe(false);
    expect(isLinkedInProfile("https://example.com/in/x")).toBe(false);
  });
  it("requires every name part to appear in the text", () => {
    expect(nameAppears("Riya Sharma", "Riya Sharma - CEO at Zomint")).toBe(true);
    expect(nameAppears("Riya Sharma", "Riya Patel - CEO")).toBe(false);
  });
});

describe("LinkedIn search link", () => {
  it("builds a plain search address from the founder and company, or the company alone", async () => {
    const { linkedinSearchUrl } = await import("@/components/actions/linkedin-link");
    expect(linkedinSearchUrl({ founder: "Riya Sharma", company: "Zomint" })).toBe("https://www.linkedin.com/search/results/people/?keywords=Riya%20Sharma%20Zomint");
    expect(linkedinSearchUrl({ founder: null, company: "Zomint" })).toBe("https://www.linkedin.com/search/results/people/?keywords=Zomint%20founder");
  });
});

const JARGON = /On Radar|investor of interest|first time we have seen|Portfolio\b|focus deal|needs review/i;
const noRawLinks = (b: string) => (b.match(/https?:\/\//g) ?? []).length;

describe("drafts", () => {
  const facts = { company: "Zomint", founder: "Riya Sharma", stage: "Seed", amountText: "$2 million", amountUsd: 2_000_000, amountInr: 170_000_000, sector: "Fintech", summary: "Wealth management app for first-time investors", sourceUrl: "https://ex.com/a", outlet: "Entrackr" };
  it("writes a founder email as Aarav: congratulates on the round, names the product, asks for 20 minutes, no link", () => {
    const d = founderEmailDraft(facts, sender);
    expect(d.body).toContain("Hi Riya,");
    expect(d.body).toContain("Congratulations on Zomint's Seed round of $2 million");
    expect(d.body).toContain("I read about it in Entrackr");
    expect(d.body).toContain("I'm Aarav, a venture scout at Cloudburst Ventures");
    expect(d.body).toContain("What caught my attention: Wealth management app for first-time investors.");
    expect(d.body).toContain("20-minute call");
    expect(d.body).toContain("Warm regards,\nAarav\nVenture Scout, Cloudburst Ventures");
    expect(noRawLinks(d.body)).toBe(0);
    expect(d.body).not.toMatch(JARGON);
    expect(d.body).not.toMatch(/undefined|null/);
    expect(d.body.split("\n\n")[1].split(/(?<=[.?!])\s/).length).toBeLessThanOrEqual(6);
  });
  it("leaves out unknown facts instead of guessing", () => {
    const d = founderEmailDraft({ ...facts, founder: null, amountText: "Undisclosed", amountUsd: null, amountInr: null, stage: "Unknown", summary: null, sourceUrl: null, outlet: null }, sender);
    expect(d.body).toContain("Hi Zomint team,");
    expect(d.body).toContain("Congratulations on the news from Zomint.");
    expect(d.body).not.toMatch(/undefined|null|Undisclosed|Unknown/);
  });
  it("keeps the LinkedIn note short", () => {
    expect(linkedinNoteDraft(facts, sender).length).toBeLessThanOrEqual(300);
  });
  it("a note about nearby raises names them, with no links, and offers an intro or a conversation", () => {
    const d = portfolioFollowUpDraft(
      { kind: "cluster", company: "Wealthify", recipientName: "Riya Sharma", named: [], windowDays: 10, adjacent: [{ company: "A", stage: "Seed", amountText: "$1M", sharedTerms: ["wealth"], sourceUrl: "https://ex.com/1" }, { company: "B", stage: null, amountText: null, sharedTerms: ["wealth", "advisory"], sourceUrl: "https://ex.com/2" }] },
      sender,
    );
    expect(d.body).toContain("Hi Riya,");
    expect(d.body).toContain("Two companies working close to Wealthify raised within ten days of each other: A and B.");
    expect(d.body).toContain("intro or a conversation");
    expect(noRawLinks(d.body)).toBe(0);
    expect(d.body).not.toMatch(JARGON);
  });
  it("a note about the company itself is short and supportive", () => {
    const d = portfolioFollowUpDraft({ kind: "named", company: "Wealthify", recipientName: null, named: [{ stage: "Seed", amountText: null, amountUsd: 3_000_000, amountInr: null, sourceUrl: "https://ex.com/1" }], adjacent: [], windowDays: 10 }, sender);
    expect(d.body).toContain("Wealthify raised $3 million in a Seed round");
    expect(noRawLinks(d.body)).toBe(0);
  });
});

describe("LP note", () => {
  const cap = (sector: string, deals: number, usd: number, base: number) => ({ sector, deals, disclosedUsd: usd, disclosedInr: usd * 85, disclosedCount: deals, undisclosed: [], baselineAvgUsd: base });
  const trend = (sector: string, thisWeek: number, avg: number, status: "accelerating" | "steady") => ({ sector, isFocus: true, thisWeek, baselineTotal: avg * 8, baselineAvg: avg, ratio: avg ? thisWeek / avg : null, extra: thisWeek - avg, status, series: [] });
  const { bullets, leadSectors } = lpBullets(
    [cap("Media, deeptech & education", 14, 266_000_000, 44_000_000), cap("Climate & sustainability", 3, 214_000_000, 50_000_000), cap("Fintech", 7, 20_000_000, 10_000_000)],
    [trend("Fintech", 7, 1.5, "accelerating"), trend("Climate & sustainability", 3, 3, "steady")],
  );
  it("builds at most three bullets, all from the computed figures", () => {
    expect(bullets).toEqual([
      "Deeptech led the week: $266M disclosed across 14 rounds, roughly six times a usual week.",
      "Climate followed with $214M across 3 rounds.",
      "Fintech is busy again: 7 rounds against a usual 2.",
    ]);
    expect(leadSectors).toEqual(["deeptech", "climate"]);
  });
  it("follows the LP template: greeting, three things, close to home, one brief link, call offer, sign-off", () => {
    const d = lpBriefDraft({ fundName: "Cloudburst Ventures", weekStartLabel: "5 Oct", recipientName: "Meera Rao", deals: 24, bullets, leadSectors, nearby: { companies: 2, sector: "Climate & sustainability", windowDays: 10, portfolioName: "Numocity" }, reportUrl: "https://app.example/report/2026-10-05" }, sender);
    expect(d.subject).toBe("Week of 5 Oct: deeptech and climate pull in the big cheques");
    const parts = d.body.split("\n\n");
    expect(parts[0]).toBe("Hi Meera,");
    expect(parts[1]).toBe("A quick read on last week, before your Monday gets busy.");
    expect(parts[2].startsWith("Three things stood out:\n• ")).toBe(true);
    expect(parts[2].split("\n").filter((l) => l.startsWith("•")).length).toBe(3);
    expect(parts[3]).toBe("Closer to home, two climate companies raised within ten days of each other, right next to Numocity. I'll check in with the team this week and share what I hear.");
    expect(parts[4]).toBe("The full brief, with every source, is here: https://app.example/report/2026-10-05");
    expect(parts[5]).toBe("Happy to walk you through any of it on a call.");
    expect(parts[6]).toBe("Warm regards,\nAarav\nVenture Scout, Cloudburst Ventures");
    expect(noRawLinks(d.body)).toBe(1);
    expect(d.body).not.toMatch(JARGON);
  });
  it("copes with a quiet week and no nearby cluster", () => {
    const q = lpBullets([], []);
    const d = lpBriefDraft({ fundName: "x", weekStartLabel: "5 Oct", recipientName: null, deals: 2, bullets: q.bullets, leadSectors: q.leadSectors, nearby: null, reportUrl: "https://app.example/r" }, sender);
    expect(d.subject).toBe("Week of 5 Oct: a quiet one");
    expect(d.body).toContain("Hi,");
    expect(d.body).toContain("It was a quiet week: 2 rounds tracked");
    expect(d.body).not.toContain("Closer to home");
  });
});
