/** Feed discovery and parsing, and turning web pages into plain text. No database here. */
import { XMLParser } from "fast-xml-parser";
import { getText } from "@/lib/http";

export interface FeedItem {
  title: string;
  url: string;
  publishedAt: Date | null;
  summary: string; // plain text from the feed (may be short)
  content: string; // plain text from the full-content field, when the feed has one
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  processEntities: true,
  isArray: (name) => ["item", "entry", "link"].includes(name),
});

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", rupee: "₹" };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
const safeChar = (n: number) => {
  try {
    return String.fromCodePoint(n);
  } catch {
    return " ";
  }
};

/** Plain text from an HTML string. Prefers the article body, drops scripts, menus and footers. */
export function htmlToText(html: string): string {
  let h = html;
  h = h.replace(/<!--[\s\S]*?-->/g, " ");
  h = h.replace(/<(script|style|noscript|svg|iframe|form|nav|footer|header|aside|button)[\s\S]*?<\/\1>/gi, " ");
  const article = h.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? h.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? h.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? h;
  const withBreaks = article.replace(/<\/(p|div|li|h[1-6]|tr|table|section|blockquote)>|<br\s*\/?>/gi, "\n");
  const text = decodeEntities(withBreaks.replace(/<[^>]+>/g, " "));
  return text
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function pageMeta(html: string): { title: string | null; publishedAt: Date | null } {
  const meta = (re: RegExp) => html.match(re)?.[1] ?? null;
  const title =
    meta(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    meta(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ??
    meta(/<title[^>]*>([^<]+)<\/title>/i);
  const dateStr =
    meta(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) ??
    meta(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i) ??
    meta(/<time[^>]+datetime=["']([^"']+)["']/i);
  const d = dateStr ? new Date(dateStr) : null;
  return { title: title ? decodeEntities(title).trim() : null, publishedAt: d && !Number.isNaN(d.getTime()) ? d : null };
}

const text = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as object)) return String((v as Record<string, unknown>)["#text"]);
  return "";
};

/** Reads RSS 2.0 and Atom. Returns null if the text is not a feed. */
export function parseFeed(xml: string): FeedItem[] | null {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml);
  } catch {
    return null;
  }
  const rss = doc.rss as { channel?: { item?: Record<string, unknown>[] } } | undefined;
  const atom = doc.feed as { entry?: Record<string, unknown>[] } | undefined;
  const items: FeedItem[] = [];
  if (rss?.channel) {
    for (const it of rss.channel.item ?? []) {
      const links = (it.link as unknown[] | undefined) ?? [];
      const link = text(links[0]) || text(it.guid);
      const when = text(it.pubDate) || text(it["dc:date"]);
      items.push(toItem(text(it.title), link, when, text(it.description), text(it["content:encoded"])));
    }
    return items;
  }
  if (atom) {
    for (const en of atom.entry ?? []) {
      const links = (en.link as Record<string, string>[] | undefined) ?? [];
      const alt = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0];
      items.push(toItem(text(en.title), alt?.["@_href"] ?? "", text(en.published) || text(en.updated), text(en.summary), text(en.content)));
    }
    return items;
  }
  return null;
}

function toItem(title: string, link: string, when: string, summary: string, content: string): FeedItem {
  const d = when ? new Date(when) : null;
  return {
    title: decodeEntities(title).replace(/\s+/g, " ").trim(),
    url: link.trim(),
    publishedAt: d && !Number.isNaN(d.getTime()) ? d : null,
    summary: htmlToText(summary),
    content: htmlToText(content),
  };
}

const CANDIDATE_PATHS = ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml", "/feed/"];

/** Tries the usual feed addresses, then the homepage's <link rel="alternate">. Returns a working feed URL or null. */
export async function discoverFeed(site: string): Promise<{ feedUrl: string | null; tried: number }> {
  const hosts = [`https://${site}`, `https://www.${site}`];
  let tried = 0;
  for (const host of hosts) {
    for (const p of CANDIDATE_PATHS) {
      tried++;
      try {
        const { text: body } = await getText(host + p, { timeoutMs: 6000, maxBytes: 600_000, accept: "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.5" });
        if (parseFeed(body)?.length) return { feedUrl: host + p, tried };
      } catch {
        /* try the next address */
      }
    }
    try {
      tried++;
      const { text: home } = await getText(host, { timeoutMs: 7000, maxBytes: 400_000 });
      const links = [...home.matchAll(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi)].map((m) => m[0]);
      for (const l of links) {
        const href = l.match(/href=["']([^"']+)["']/i)?.[1];
        if (!href) continue;
        const abs = new URL(decodeEntities(href), host).toString();
        try {
          const { text: body } = await getText(abs, { timeoutMs: 6000, maxBytes: 600_000 });
          if (parseFeed(body)?.length) return { feedUrl: abs, tried };
        } catch {
          /* next */
        }
      }
    } catch {
      /* homepage unreachable */
    }
  }
  return { feedUrl: null, tried };
}

const FUNDING_WORDS =
  /\b(rais(?:e|es|ed|ing)|fund(?:s|ed|ing|raise)?|invest(?:s|ed|ment|ors?)?|seed|series\s?[a-f]\b|pre-?series|pre-?seed|round|backed|secur(?:e|es|ed)|bags|closes|infus(?:e|es|ed|ion)|mobili[sz]es?|crore|\bcr\b|million|\bmn\b|debt financing|venture debt|capital)\b/i;

export function looksLikeFunding(s: string): boolean {
  return FUNDING_WORDS.test(s);
}

const ROUNDUP = /(weekly|this week|week['’]?s)\b.*\b(fund|deal|raise|invest)|\b(fund(?:ing|ed)|deals?)\b.*\b(roundup|round-up|report|recap|wrap)|funding (?:and|&) acquisitions/i;

export function looksLikeRoundup(title: string): boolean {
  return ROUNDUP.test(title);
}

export async function fetchArticle(url: string, maxChars: number): Promise<{ text: string; title: string | null; publishedAt: Date | null }> {
  const { text: html } = await getText(url, { timeoutMs: 9000, maxBytes: 1_800_000 });
  const meta = pageMeta(html);
  const body = htmlToText(html);
  return { text: body.slice(0, maxChars), title: meta.title, publishedAt: meta.publishedAt };
}
