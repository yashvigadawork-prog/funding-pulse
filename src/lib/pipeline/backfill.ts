/**
 * Backfill (one-off, not part of the weekly run): find weekly funding roundups from the
 * configured outlets and read 6 to 8 weeks of history from them. One roundup holds many deals,
 * so this uses few Gemini calls and gives the trend charts a baseline.
 */
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import type { ConfigBlocks } from "@/lib/config/store";
import { canonicalUrl, domainOf, getText } from "@/lib/http";
import { search, SearchBudget } from "@/lib/search";
import { addDays, weekStartIST } from "@/lib/time";
import { chooseDealDate, roundupEndFromTitle } from "./dates";
import { fetchArticle, looksLikeRoundup } from "./feeds";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MON_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Roundup list pages we know about. Each link found there is a candidate; the search fills the rest. */
const LISTING_HINTS: Record<string, string[]> = {
  "entrackr.com": ["https://entrackr.com/report/weekly-funding-report", "https://entrackr.com/report/weekly-funding-report?page=2", "https://entrackr.com/report/weekly-funding-report?page=3"],
};

/** "...this-week-oct-5-oct-10-12662210" -> 10 Oct, using the nearest year that is not in the future. */
export function slugEndDate(slug: string, today: string): string | null {
  const m = slug.toLowerCase().match(/(jan|feb|mar|apr|may|june?|july?|aug|sep|oct|nov|dec)[a-z]*-(\d{1,2})-(jan|feb|mar|apr|may|june?|july?|aug|sep|oct|nov|dec)[a-z]*-(\d{1,2})(?:-(\d{4}))?(?:-|$)/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[3].slice(0, 3)) + 1;
  const day = parseInt(m[4], 10);
  let year = m[5] ? parseInt(m[5], 10) : parseInt(today.slice(0, 4), 10);
  let d = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!m[5] && d > addDays(today, 3)) d = `${--year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()) ? null : d;
}

export interface BackfillResult {
  weeksWanted: string[];
  roundupsFound: number;
  alreadyHad: number;
  saved: number;
  weeksWithoutRoundup: string[];
  searchQueries: number;
  notes: string[];
}

interface Found {
  url: string;
  title: string;
  end: string | null;
  outlet: string;
}

export async function backfillRoundups(p: { blocks: ConfigBlocks; deadline: number; weeks?: number; today?: string }): Promise<BackfillResult> {
  const { blocks } = p;
  const settings = blocks.digest_settings;
  const today = p.today ?? new Date().toISOString().slice(0, 10);
  const nWeeks = p.weeks ?? settings.backfill_weeks;
  const thisMonday = weekStartIST();
  const weeks = Array.from({ length: nWeeks }, (_, i) => addDays(thisMonday, -7 * (nWeeks - i)));
  const res: BackfillResult = { weeksWanted: weeks, roundupsFound: 0, alreadyHad: 0, saved: 0, weeksWithoutRoundup: [], searchQueries: 0, notes: [] };
  const sources = blocks.sources.rss_and_sites.filter((s) => s.enabled && s.kind === "startup_media");
  const budget = new SearchBudget(Math.max(settings.max_search_queries_per_run, nWeeks * 3));

  // week -> roundups found
  const found = new Map<string, Found[]>();
  const add = (f: Found) => {
    if (!f.end) return;
    const w = weekStartIST(new Date(`${f.end}T06:00:00Z`));
    if (!weeks.includes(w)) return;
    const arr = found.get(w) ?? [];
    if (!arr.some((x) => x.url === f.url) && arr.filter((x) => x.outlet === f.outlet).length === 0) arr.push(f);
    found.set(w, arr);
  };

  // 1. listing pages we know about
  for (const s of sources) {
    for (const page of LISTING_HINTS[s.site] ?? []) {
      try {
        const { text } = await getText(page, { timeoutMs: 9000, maxBytes: 1_500_000 });
        for (const m of text.matchAll(/href="([^"]*(?:funding-and-acquisitions|weekly-funding)[^"]*)"/gi)) {
          const url = canonicalUrl(new URL(m[1], page).toString());
          const slug = url.split("/").pop() ?? "";
          const end = slugEndDate(slug, today);
          if (end && /this-week/.test(slug)) add({ url, title: slug.replace(/-/g, " "), end, outlet: s.outlet });
        }
      } catch {
        res.notes.push(`Could not read the ${s.outlet} list page.`);
      }
    }
  }

  // 2. search for each missing week
  for (const w of weeks) {
    if ((found.get(w)?.length ?? 0) >= 1 || Date.now() > p.deadline) continue;
    const mon = new Date(`${w}T00:00:00Z`);
    const sun = new Date(`${addDays(w, 5)}T00:00:00Z`);
    const range = `${MON_LONG[mon.getUTCMonth()]} ${mon.getUTCDate()} ${MON_LONG[sun.getUTCMonth()]} ${sun.getUTCDate()}`;
    for (const s of sources.slice(0, 3)) {
      if (budget.exhausted || (found.get(w)?.length ?? 0) >= 2) break;
      const out = await search(`${s.outlet} weekly funding report Indian startups this week ${range} ${mon.getUTCFullYear()}`, { limit: 6, includeDomains: [s.site] }, { chain: blocks.search_chain, settings, budget });
      for (const r of out.results) {
        const end = roundupEndFromTitle(r.title, r.date ? new Date(r.date) : null) ?? slugEndDate(r.url.split("/").pop() ?? "", today);
        if (!end || !(looksLikeRoundup(r.title) || /weekly|this-week|funding-galore|roundup/i.test(r.url))) continue;
        add({ url: r.url, title: r.title, end, outlet: domainOf(r.url) === s.site || domainOf(r.url).endsWith(`.${s.site}`) ? s.outlet : domainOf(r.url) });
      }
    }
  }
  res.searchQueries = budget.used;

  // 3. fetch and store each roundup we do not have yet
  const all = [...found.values()].flat();
  res.roundupsFound = all.length;
  const have = new Set(all.length ? (await db.select({ url: articles.url }).from(articles).where(inArray(articles.url, all.map((a) => a.url)))).map((r) => r.url) : []);
  for (const f of all) {
    if (have.has(f.url)) {
      res.alreadyHad++;
      continue;
    }
    if (Date.now() > p.deadline) {
      res.notes.push("Ran out of time. Run the backfill again to continue.");
      break;
    }
    try {
      const a = await fetchArticle(f.url, Math.max(settings.max_article_chars * 4, 24_000));
      if (a.text.length < 400) continue;
      const published = a.publishedAt ?? new Date(`${f.end}T06:00:00Z`);
      await db
        .insert(articles)
        .values({ url: f.url, outlet: f.outlet, title: a.title ?? f.title, publishedAt: published, text: a.text, textHash: String(a.text.length), kind: "roundup", via: "backfill", processed: false })
        .onConflictDoNothing();
      res.saved++;
    } catch {
      res.notes.push(`Could not fetch ${f.outlet} roundup for ${f.end}.`);
    }
  }
  res.weeksWithoutRoundup = weeks.filter((w) => !found.get(w)?.length);
  void chooseDealDate;
  return res;
}
