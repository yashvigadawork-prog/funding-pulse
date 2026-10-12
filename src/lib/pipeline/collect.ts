/**
 * Collect: read each enabled source's feed, then use search() to fill gaps.
 * Everything fetched is stored as untrusted text in the articles table.
 */
import { createHash } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import type { CompanyJson, DigestSettings, InvestorJson, Mandate, SearchChain, SourceEntry, Sources } from "@/lib/config/schema";
import { canonicalUrl, domainOf } from "@/lib/http";
import { search, SearchBudget, type SearchResult } from "@/lib/search";
import { discoverFeed, fetchArticle, looksLikeFunding, looksLikeRoundup, parseFeed, type FeedItem } from "./feeds";
import { getText } from "@/lib/http";

export interface CollectInput {
  since: Date;
  until: Date;
  settings: DigestSettings;
  sources: Sources;
  chain: SearchChain;
  mandate: Mandate;
  onRadar: CompanyJson[];
  investors: InvestorJson[];
  budget: SearchBudget;
  deadline: number; // epoch ms: stop starting new work after this
  /** Called when a feed address was found automatically, so it can be saved to the sources config. */
  onFeedDiscovered?: (outlet: string, feedUrl: string) => Promise<void>;
}

export interface CollectResult {
  newArticles: number;
  sourcesTotal: number;
  sourcesReachable: number;
  unreachable: string[];
  feedsDiscovered: number;
  searchQueries: number;
  searchProviders: Record<string, number>;
  cacheHits: number;
  searchErrors: string[];
  linkedinResults: number;
  searchAttempted: number;
  searchAnswered: number;
  /** True when searches were tried and no provider answered any of them. */
  searchUnavailable: boolean;
  /** Outlets whose feed was unreachable but which were searched through their own site instead. */
  searchedInstead: string[];
}

export interface GapQuery {
  query: string;
  purpose: "sector" | "outlet" | "radar" | "linkedin";
  includeDomains?: string[];
}

/** Builds the search queries that fill gaps the feeds missed. Pure, so it is easy to test. */
export function buildGapQueries(p: {
  mandate: Mandate;
  onRadar: CompanyJson[];
  investors: InvestorJson[];
  linkedin: Sources["linkedin_via_search"];
  maxQueries: number;
  /** Outlets whose feed could not be read. They are covered through a search limited to their own website. */
  outlets?: { outlet: string; site: string }[];
}): GapQuery[] {
  const out: GapQuery[] = [];
  for (const s of p.mandate.focus_sectors) out.push({ query: `India ${s} startup raises funding round this week`, purpose: "sector" });
  const outletCap = Math.max(0, Math.floor(p.maxQueries * 0.25));
  for (const o of (p.outlets ?? []).slice(0, outletCap)) out.push({ query: `${o.outlet} startup raises funding round`, purpose: "outlet", includeDomains: [o.site] });
  const rank = { high: 0, medium: 1, low: 2 } as Record<string, number>;
  const radar = [...p.onRadar].sort((a, b) => (rank[a.priority ?? "low"] ?? 3) - (rank[b.priority ?? "low"] ?? 3));
  const radarCap = Math.max(0, Math.floor(p.maxQueries * 0.35));
  for (const c of radar.slice(0, radarCap)) out.push({ query: `${c.name} raises funding seed OR "pre-Series A" OR "Series A"`, purpose: "radar" });
  if (p.linkedin.enabled) {
    const liCap = Math.max(0, Math.floor(p.maxQueries * 0.25));
    const li: GapQuery[] = [];
    const templates = p.linkedin.query_templates;
    let i = 0;
    while (li.length < liCap && i < 200) {
      for (const t of templates) {
        let q = t;
        if (t.includes("{investor}")) {
          const inv = p.investors[i % Math.max(1, p.investors.length)];
          if (!inv) continue;
          q = q.replace("{investor}", inv.name);
        }
        if (t.includes("{sector}")) q = q.replace("{sector}", p.mandate.focus_sectors[i % Math.max(1, p.mandate.focus_sectors.length)] ?? "startup");
        if (t.includes("{company}")) {
          const c = radar[i % Math.max(1, radar.length)];
          if (!c) continue;
          q = q.replace("{company}", c.name);
        }
        if (!li.some((x) => x.query === q)) li.push({ query: q, purpose: "linkedin", includeDomains: [p.linkedin.include_domain || "linkedin.com"] });
        if (li.length >= liCap) break;
      }
      i++;
    }
    out.push(...li);
  }
  return out.slice(0, p.maxQueries);
}

const hashText = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 32);

function outletFor(url: string, sources: SourceEntry[]): string {
  const host = domainOf(url);
  const hit = sources.find((s) => host === s.site || host.endsWith(`.${s.site}`));
  return hit?.outlet ?? host;
}

async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function existingUrls(urls: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < urls.length; i += 200) {
    const rows = await db.select({ url: articles.url }).from(articles).where(inArray(articles.url, urls.slice(i, i + 200)));
    for (const r of rows) found.add(r.url);
  }
  return found;
}

interface Pending {
  url: string;
  title: string;
  publishedAt: Date | null;
  outlet: string;
  via: string;
  text: string;
  kind: "article" | "roundup" | "linkedin";
}

async function saveArticles(items: Pending[]): Promise<number> {
  if (!items.length) return 0;
  const rows = await db
    .insert(articles)
    .values(
      items.map((p) => ({
        url: p.url,
        outlet: p.outlet,
        title: p.title.slice(0, 300),
        publishedAt: p.publishedAt,
        textHash: hashText(p.text),
        text: p.text,
        kind: p.kind,
        via: p.via,
        processed: false,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: articles.id });
  return rows.length;
}

function textCap(kind: Pending["kind"], settings: DigestSettings) {
  return kind === "roundup" ? Math.max(settings.max_article_chars * 4, 24_000) : settings.max_article_chars;
}

export async function collect(input: CollectInput): Promise<CollectResult> {
  const { settings, sources, since, until } = input;
  const enabled = sources.rss_and_sites.filter((s) => s.enabled);
  const result: CollectResult = {
    newArticles: 0,
    sourcesTotal: enabled.length,
    sourcesReachable: 0,
    unreachable: [],
    feedsDiscovered: 0,
    searchQueries: 0,
    searchProviders: {},
    cacheHits: 0,
    searchErrors: [],
    linkedinResults: 0,
    searchAttempted: 0,
    searchAnswered: 0,
    searchUnavailable: false,
    searchedInstead: [],
  };

  /* ---- 1. feeds ---- */
  const feedBatches = await pool(enabled, 4, async (src) => {
    if (Date.now() > input.deadline) return { src, items: null as FeedItem[] | null };
    let feedUrl = src.feed_url;
    try {
      if (!feedUrl) {
        const found = await discoverFeed(src.site);
        if (found.feedUrl) {
          feedUrl = found.feedUrl;
          result.feedsDiscovered++;
          await input.onFeedDiscovered?.(src.outlet, found.feedUrl);
        }
      }
      if (!feedUrl) return { src, items: null };
      const { text } = await getText(feedUrl, { timeoutMs: 9000, maxBytes: 2_000_000, accept: "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.5" });
      const items = parseFeed(text);
      return { src, items };
    } catch {
      return { src, items: null };
    }
  });

  const candidates: { item: FeedItem; src: SourceEntry; kind: "article" | "roundup" }[] = [];
  for (const b of feedBatches) {
    if (!b.items) {
      result.unreachable.push(b.src.outlet);
      continue;
    }
    result.sourcesReachable++;
    for (const item of b.items) {
      if (!item.url) continue;
      const when = item.publishedAt;
      if (when && (when < since || when > until)) continue;
      const roundup = looksLikeRoundup(item.title);
      if (!roundup && !looksLikeFunding(`${item.title} ${item.summary.slice(0, 300)}`)) continue;
      candidates.push({ item: { ...item, url: canonicalUrl(item.url) }, src: b.src, kind: roundup ? "roundup" : "article" });
    }
  }

  const seen = new Set<string>();
  const unique = candidates.filter((c) => (seen.has(c.item.url) ? false : (seen.add(c.item.url), true)));
  const known = await existingUrls(unique.map((c) => c.item.url));
  const fresh = unique
    .filter((c) => !known.has(c.item.url))
    .sort((a, b) => Number(b.kind === "roundup") - Number(a.kind === "roundup") || (b.item.publishedAt?.getTime() ?? 0) - (a.item.publishedAt?.getTime() ?? 0))
    .slice(0, settings.max_articles_per_run);

  const pending: Pending[] = [];
  await pool(fresh, 4, async (c) => {
    if (Date.now() > input.deadline) return;
    const cap = textCap(c.kind, settings);
    let text = c.item.content.length >= 600 ? c.item.content : "";
    if (!text) {
      try {
        const a = await fetchArticle(c.item.url, cap);
        text = a.text;
      } catch {
        text = "";
      }
    }
    if (text.length < 200 && c.item.summary.length >= 80) text = c.item.summary;
    if (text.length < 80) return;
    pending.push({
      url: c.item.url,
      title: c.item.title,
      publishedAt: c.item.publishedAt,
      outlet: c.src.outlet,
      via: "feed",
      text: text.slice(0, cap),
      kind: c.kind,
    });
  });
  result.newArticles += await saveArticles(pending);

  /* ---- 2. search for gaps ---- */
  const queries = buildGapQueries({
    mandate: input.mandate,
    onRadar: input.onRadar,
    investors: input.investors,
    linkedin: sources.linkedin_via_search,
    maxQueries: settings.max_search_queries_per_run,
    outlets: enabled.filter((s) => result.unreachable.includes(s.outlet)).map((s) => ({ outlet: s.outlet, site: s.site })),
  });
  const days = Math.max(1, Math.ceil((until.getTime() - since.getTime()) / 86_400_000));
  const searchPending: Pending[] = [];
  const queued = new Set<string>();
  for (const q of queries) {
    if (Date.now() > input.deadline || input.budget.exhausted) break;
    const out = await search(q.query, { limit: 8, days, includeDomains: q.includeDomains }, { chain: input.chain, settings, budget: input.budget });
    if (q.purpose === "outlet" && !out.skippedForBudget) {
      const o = enabled.find((s) => s.site === q.includeDomains?.[0]);
      if (o && out.results.length) result.searchedInstead.push(o.outlet);
    }
    if (!out.skippedForBudget) {
      result.searchAttempted++;
      if (out.provider) result.searchAnswered++;
    }
    if (out.errors.length) result.searchErrors.push(...out.errors.map((e) => `${e.provider}: ${e.message}`));
    const fresh2 = await existingUrls(out.results.map((r) => r.url));
    for (const r of out.results) {
      if (fresh2.has(r.url) || queued.has(r.url)) continue;
      const when = r.date ? new Date(r.date) : null;
      if (when && (when < since || when > until)) continue;
      queued.add(r.url);
      if (q.purpose === "linkedin") {
        const body = `${r.title}\n${r.snippet}`.trim();
        if (body.length < 60 || !looksLikeFunding(body)) continue;
        searchPending.push({ url: r.url, title: r.title || "LinkedIn post", publishedAt: when, outlet: "LinkedIn", via: out.provider ?? "search", text: body, kind: "linkedin" });
        result.linkedinResults++;
      } else {
        if (!looksLikeFunding(`${r.title} ${r.snippet}`)) continue;
        searchPending.push(await resultToPending(r, out.provider ?? "search", settings, input.sources.rss_and_sites));
      }
    }
  }
  // The search result date can be missing, so also check the date found on the page itself.
  const searchReady = searchPending.filter((p) => p.text.length >= 80 && !(p.publishedAt && (p.publishedAt < since || p.publishedAt > until)));
  result.newArticles += await saveArticles(searchReady);
  result.searchQueries = input.budget.used;
  result.searchProviders = { ...input.budget.providerCounts };
  result.cacheHits = input.budget.cacheHits;
  result.searchUnavailable = result.searchAttempted > 0 && result.searchAnswered === 0;
  return result;
}

async function resultToPending(r: SearchResult, provider: string, settings: DigestSettings, sources: SourceEntry[]): Promise<Pending> {
  const outlet = outletFor(r.url, sources);
  let text = r.snippet;
  let title = r.title;
  let published = r.date ? new Date(r.date) : null;
  try {
    const a = await fetchArticle(r.url, settings.max_article_chars);
    if (a.text.length > text.length) text = a.text;
    if (a.title && (!title || title === domainOf(r.url))) title = a.title;
    if (!published && a.publishedAt) published = a.publishedAt;
  } catch {
    /* the snippet alone is kept */
  }
  return { url: r.url, title: title || r.url, publishedAt: published, outlet, via: provider, text: text.slice(0, settings.max_article_chars), kind: looksLikeRoundup(title) ? "roundup" : "article" };
}

/** Stores a post pasted by the user (LinkedIn paste box or any article text). */
export async function addPastedArticle(p: { text: string; url?: string | null; title?: string | null }): Promise<number | null> {
  const text = p.text.trim().slice(0, 12_000);
  if (text.length < 40) return null;
  const hash = hashText(text);
  const url = p.url?.trim() ? canonicalUrl(p.url) : `paste:${hash}`;
  const n = await saveArticles([
    { url, title: p.title?.trim() || text.slice(0, 80), publishedAt: new Date(), outlet: p.url ? outletFor(p.url, []) : "Pasted post", via: "paste", text, kind: "article" },
  ]);
  return n;
}
