import { describe, expect, it } from "vitest";
import { htmlToText, looksLikeFunding, looksLikeRoundup, pageMeta, parseFeed } from "./feeds";

const rss = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>X</title>
<item><title>Zomint raises $2 Mn in seed round</title><link>https://ex.com/a?utm_source=x</link><pubDate>Mon, 06 Oct 2026 08:00:00 +0530</pubDate>
<description><![CDATA[<p>Wealth startup <b>Zomint</b> raised money.</p>]]></description><content:encoded><![CDATA[<p>Full text &amp; more.</p>]]></content:encoded></item>
<item><title>Weekly funding report: Indian startups this week</title><link>https://ex.com/b</link><pubDate>Sat, 11 Oct 2026 08:00:00 +0530</pubDate><description>x</description></item>
</channel></rss>`;
const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Acme secures funding</title><link rel="alternate" href="https://ex.com/c"/><published>2026-10-07T10:00:00Z</published><summary>Acme news</summary></entry></feed>`;

describe("parseFeed", () => {
  it("reads RSS items with dates, summary and full content", () => {
    const items = parseFeed(rss)!;
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Zomint raises $2 Mn in seed round");
    expect(items[0].summary).toBe("Wealth startup Zomint raised money.");
    expect(items[0].content).toBe("Full text & more.");
    expect(items[0].publishedAt?.toISOString()).toBe("2026-10-06T02:30:00.000Z");
  });
  it("reads Atom entries", () => {
    const items = parseFeed(atom)!;
    expect(items[0].url).toBe("https://ex.com/c");
    expect(items[0].publishedAt).not.toBeNull();
  });
  it("returns null for things that are not feeds", () => {
    expect(parseFeed("<html><body>hello</body></html>")).toBeNull();
  });
});

describe("htmlToText", () => {
  it("keeps the article body and drops scripts and menus", () => {
    const html = `<html><body><nav>Menu</nav><script>alert(1)</script><article><h1>Title</h1><p>First &amp; second.</p><p>Third.</p></article><footer>Foot</footer></body></html>`;
    expect(htmlToText(html)).toBe("Title\nFirst & second.\nThird.");
  });
});

describe("pageMeta", () => {
  it("reads title and date", () => {
    const m = pageMeta(`<meta property="og:title" content="Hello &amp; bye"><meta property="article:published_time" content="2026-10-01T00:00:00Z">`);
    expect(m.title).toBe("Hello & bye");
    expect(m.publishedAt?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("relevance filters", () => {
  it("spots funding headlines", () => {
    expect(looksLikeFunding("Startup raises Rs 40 crore")).toBe(true);
    expect(looksLikeFunding("Founders discuss hiring tips")).toBe(false);
  });
  it("spots weekly roundups", () => {
    expect(looksLikeRoundup("Funding and acquisitions in Indian startups this week")).toBe(true);
    expect(looksLikeRoundup("Weekly funding report: Oct 5 - Oct 10")).toBe(true);
    expect(looksLikeRoundup("Zomint raises $2 Mn")).toBe(false);
  });
});
