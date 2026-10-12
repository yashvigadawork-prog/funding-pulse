import { describe, expect, it } from "vitest";
import { extractEmails, isLinkedInProfile, nameAppears } from "./contacts";
import { founderEmailDraft, linkedinNoteDraft, lpBriefDraft, portfolioFollowUpDraft } from "./drafts";

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

describe("drafts", () => {
  const facts = { company: "Zomint", founder: "Riya Sharma", stage: "Seed", amountText: "$2 million", sector: "Fintech", summary: "Wealth management app.", sourceUrl: "https://ex.com/a" };
  it("writes a founder email with the source link and the sender's intro", () => {
    const d = founderEmailDraft(facts, sender);
    expect(d.body).toContain("Hi Riya,");
    expect(d.body).toContain("raised $2 million in a Seed round");
    expect(d.body).toContain("https://ex.com/a");
    expect(d.body).toContain("Bengaluru-based family office");
    expect(d.body).not.toMatch(/undefined|null/);
  });
  it("leaves out unknown facts instead of guessing", () => {
    const d = founderEmailDraft({ ...facts, founder: null, amountText: "Undisclosed", stage: "Unknown", summary: null, sourceUrl: null }, sender);
    expect(d.body).toContain("Hi Zomint team,");
    expect(d.body).toContain("announced new funding");
    expect(d.body).not.toMatch(/undefined|null|Undisclosed|Unknown/);
  });
  it("keeps the LinkedIn note short", () => {
    expect(linkedinNoteDraft(facts, sender).length).toBeLessThanOrEqual(300);
  });
  it("follow-up for a cluster lists the adjacent deals with links", () => {
    const d = portfolioFollowUpDraft(
      { kind: "cluster", company: "Wealthify", recipientName: "Demo Founder", named: [], windowDays: 10, adjacent: [{ company: "A", stage: "Seed", amountText: "$1M", sharedTerms: ["wealth"], sourceUrl: "https://ex.com/1" }, { company: "B", stage: null, amountText: null, sharedTerms: ["wealth", "advisory"], sourceUrl: "https://ex.com/2" }] },
      sender,
    );
    expect(d.body).toContain("2 companies in the same space as Wealthify raised within 10 days");
    expect(d.body).toContain("https://ex.com/1");
    expect(d.body).toContain("https://ex.com/2");
  });
  it("LP brief includes the report link and key points", () => {
    const d = lpBriefDraft({ fundName: "Cloudburst Ventures", weekLabel: "5 Oct – 11 Oct 2026", deals: 3, disclosedText: "₹10 Cr ($1M)", topSector: "Fintech", highlights: [{ company: "Zomint", stage: "Seed", amountText: "$1M", sourceUrl: "https://ex.com/a", why: "Fits the mandate." }], adjacentLines: [], reportUrl: "https://app.example/report/2026-10-05" }, sender);
    expect(d.body).toContain("https://app.example/report/2026-10-05");
    expect(d.body).toContain("Zomint (Seed, $1M): Fits the mandate. https://ex.com/a");
  });
});
