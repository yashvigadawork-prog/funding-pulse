import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildLpEmail, MAX_EMAIL_POINTS } from "./email";
import { DEFAULT_DECK_SECTIONS, parseSections } from "./sections";
import { fixtureView } from "./fixture";
import { jsx, render } from "./jsx/jsx-runtime";

const sender = { name: "Aarav", title: "Venture Scout", organisation: "Cloudburst Ventures", intro_line: "", outreach_tone: "" };
const email = (sections: Parameters<typeof buildLpEmail>[0]["sections"], attach = true, recipientName: string | null = "Meera Rao") => buildLpEmail({ view: fixtureView(), sections, attach, sender, recipientName });
const bulletCount = (b: string) => b.split("\n").filter((l) => l.startsWith("•")).length;

describe("sections", () => {
  it("reads the ticked sections from the address, in the deck's own order, ignoring unknown names", () => {
    expect(parseSections("money,glance,bogus")).toEqual(["glance", "money"]);
    expect(parseSections(null)).toEqual(DEFAULT_DECK_SECTIONS);
    expect(parseSections("")).toEqual(DEFAULT_DECK_SECTIONS);
    expect(parseSections("nonsense")).toEqual([]);
  });
});

describe("deck renderer", () => {
  it("escapes everything it writes into the page", () => {
    const out = render(jsx("div", { className: "a", style: { marginTop: 5, fontWeight: 600 }, children: '<script>alert("x")</script> & co' }));
    expect(out).toBe('<div class="a" style="margin-top:5px;font-weight:600">&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co</div>');
  });
});

describe("deck pages", () => {
  it("builds only the ticked slides plus the cover, with no internal list names", async () => {
    const { renderDeckHtml, deckSlideCount } = await import("./deck");
    const view = fixtureView();
    const html = renderDeckHtml(view, ["glance", "names"]);
    expect((html.match(/class="slide/g) ?? []).length).toBe(3);
    expect(deckSlideCount(view, ["glance", "names"])).toBe(3);
    expect(html).toContain("The week at a glance");
    expect(html).toContain("Our companies in the news");
    expect(html).not.toContain("Where the money went");
    expect(html).not.toMatch(/On Radar|Portfolio|watchlist/i);
    expect(html).toContain("We follow");
  });
  it("is one self-contained page with its own fonts", async () => {
    const { renderDeckHtml } = await import("./deck");
    const html = renderDeckHtml(fixtureView(), DEFAULT_DECK_SECTIONS);
    expect(html).toContain("@font-face");
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
  });
});

describe("tailored LP email", () => {
  it("never shows more than three points, however many sections are ticked", () => {
    const e = email(["glance", "money", "momentum", "investors", "fit", "names", "nearby"]);
    expect(MAX_EMAIL_POINTS).toBe(3);
    expect(bulletCount(e.body)).toBe(3);
    expect(e.body).toContain("Three things stood out:");
  });
  it("follows the ticks: only the chosen sections write a line", () => {
    const one = email(["investors"], false);
    expect(bulletCount(one.body)).toBe(1);
    expect(one.body).toContain("One thing stood out:");
    expect(one.body).toContain("2 investors are new to our records");
    expect(one.body).toContain("1 of them ones we watch closely");
    const two = email(["fit", "names"], false);
    expect(bulletCount(two.body)).toBe(2);
    expect(two.body).toContain("led by Zomint");
    expect(two.body).toContain("1 company we back or follow was in the news, including Zomint");
  });
  it("adds the nearby paragraph only when ticked", () => {
    expect(email(["nearby"], false).body).toContain("Closer to home, two climate companies raised within ten days of each other, right next to Numocity.");
    expect(email(["money"], false).body).not.toContain("Closer to home");
  });
  it("replaces the dashboard link with an attachment sentence, and never contains a link", () => {
    const withDeck = email(["money", "momentum"], true);
    expect(withDeck.body).toContain("I've attached a short deck with the detail behind each of these.");
    const without = email(["money", "momentum"], false);
    expect(without.body).not.toContain("attached");
    for (const e of [withDeck, without]) {
      expect(e.body).not.toMatch(/https?:\/\//);
      expect(e.body).not.toMatch(/full brief/i);
      expect(e.body).not.toMatch(/On Radar|investor of interest|watchlist|Portfolio/i);
    }
  });
  it("keeps the voice: greeting by first name, same opener, call offer and sign-off", () => {
    const e = email(["money"], true);
    const parts = e.body.split("\n\n");
    expect(parts[0]).toBe("Hi Meera,");
    expect(parts[1]).toBe("A quick read on last week, before your Monday gets busy.");
    expect(e.body).toContain("Happy to walk you through any of it on a call.");
    expect(e.body.endsWith("Warm regards,\nAarav\nVenture Scout, Cloudburst Ventures")).toBe(true);
    expect(e.subject).toBe("Week of 5 Oct: deeptech and climate pull in the big cheques");
    expect(email(["money"], true, null).body.startsWith("Hi,\n\n")).toBe(true);
  });
  it("copes with only deck-only sections ticked", () => {
    const e = email(["deals"], true);
    expect(bulletCount(e.body)).toBe(0);
    expect(e.body).toContain("I've attached a short deck with the detail from last week.");
    expect(email(["deals"], false).body).toContain("Here is a short summary of last week.");
  });
});
