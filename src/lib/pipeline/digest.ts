/** Building a week's digest: compute (code) -> analyse (Gemini or template) -> store. */
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles, dealInvestors, dealSources, deals, digests, investors, investorsOfInterest } from "@/db/schema";
import { and, gte, lte } from "drizzle-orm";
import type { ConfigBlocks } from "@/lib/config/store";
import { normalizeName } from "@/lib/matching";
import { addDays, istDay } from "@/lib/time";
import { listCompanies } from "@/lib/config/store";
import { computeAdjacency, type AdjacencyDeal, type AdjacentGroup, adjacencyWindow } from "./adjacency";
import { geminiAnalyse, selectCandidates, templateAnalysis, type Analysis, type AnalysisInput, type DealView, type Highlight } from "./analyse";
import { computeWeek, type ComputeDeal, type WeekCompute } from "./compute";

/** All stored deals with their investors, as plain compute rows. */
export async function loadComputeDeals(): Promise<ComputeDeal[]> {
  const rows = await db.select().from(deals).orderBy(asc(deals.announcedOn));
  if (!rows.length) return [];
  const inv = await db
    .select({ dealId: dealInvestors.dealId, name: investors.name, role: dealInvestors.role })
    .from(dealInvestors)
    .innerJoin(investors, eq(investors.id, dealInvestors.investorId));
  const byDeal = new Map<number, { name: string; role: "lead" | "participant" }[]>();
  for (const i of inv) {
    const arr = byDeal.get(i.dealId) ?? [];
    arr.push({ name: i.name, role: i.role === "lead" ? "lead" : "participant" });
    byDeal.set(i.dealId, arr);
  }
  return rows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    companyId: r.companyId,
    matchTag: (r.matchTag as ComputeDeal["matchTag"]) ?? null,
    needsReview: r.needsReview,
    sector: r.sector ?? "Other",
    stage: r.stage,
    amountUsd: r.amountUsd,
    amountInr: r.amountInr,
    announcedOn: r.announcedOn ?? "",
    weekStart: r.weekStart ?? "",
    investors: byDeal.get(r.id) ?? [],
  }));
}

export function excerptAround(text: string, name: string): string {
  const i = text.toLowerCase().indexOf(name.toLowerCase());
  if (i < 0) return text.slice(0, 450);
  return text.slice(Math.max(0, i - 150), i + 350).replace(/\s+/g, " ").trim();
}

export async function loadDealViews(week: string, all: ComputeDeal[]): Promise<DealView[]> {
  const rows = await db.select().from(deals).where(eq(deals.weekStart, week));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const src = await db
    .select({ dealId: dealSources.dealId, id: articles.id, url: articles.url, outlet: articles.outlet, title: articles.title, text: articles.text })
    .from(dealSources)
    .innerJoin(articles, eq(articles.id, dealSources.articleId))
    .where(inArray(dealSources.dealId, ids));
  const earlier = new Set(all.filter((d) => d.weekStart < week).map((d) => normalizeName(d.companyName)));
  const byId = new Map(all.map((d) => [d.id, d]));
  return rows.map((r) => {
    const base = byId.get(r.id)!;
    const mine = src.filter((s) => s.dealId === r.id && !s.url.startsWith("paste:"));
    const pasted = src.filter((s) => s.dealId === r.id && s.url.startsWith("paste:"));
    return {
      ...base,
      amountText: r.amountText,
      summary: r.summary,
      confidence: r.confidence,
      domain: r.domain,
      founders: (r.founders as { name: string; role?: string | null }[] | null) ?? [],
      sources: mine.map((s) => ({ n: s.id, url: s.url, outlet: s.outlet, title: s.title })),
      excerpt: excerptAround((mine[0]?.text ?? pasted[0]?.text ?? r.summary ?? ""), r.companyName),
      novel: !earlier.has(normalizeName(r.companyName)),
    };
  });
}

export interface ReviewItem {
  dealId: number;
  asWritten: string;
  closestCompany: string | null;
  closestTag: string | null;
  score: number | null;
  reason: string;
  sources: { url: string; outlet: string | null }[];
}

/** Deals in the adjacency window (which can start in the previous week) with their source links. */
export async function loadAdjacencyDeals(from: string, to: string): Promise<AdjacencyDeal[]> {
  const rows = await db.select().from(deals).where(and(gte(deals.announcedOn, from), lte(deals.announcedOn, to)));
  if (!rows.length) return [];
  const src = await db
    .select({ dealId: dealSources.dealId, url: articles.url, outlet: articles.outlet })
    .from(dealSources)
    .innerJoin(articles, eq(articles.id, dealSources.articleId))
    .where(inArray(dealSources.dealId, rows.map((r) => r.id)));
  return rows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    matchTag: r.needsReview ? null : ((r.matchTag as AdjacencyDeal["matchTag"]) ?? null),
    sector: r.sector ?? "Other",
    stage: r.stage,
    amountText: r.amountText,
    announcedOn: r.announcedOn ?? from,
    summary: r.summary,
    sources: src.filter((s) => s.dealId === r.id && !s.url.startsWith("paste:")).map((s) => ({ url: s.url, outlet: s.outlet })),
  }));
}

export interface PreparedDigest {
  adjacency: AdjacentGroup[];
  needsReview: ReviewItem[];
  week: string;
  compute: WeekCompute;
  views: DealView[];
  candidates: Highlight[];
  input: AnalysisInput;
}

export async function prepareDigest(week: string, blocks: ConfigBlocks): Promise<PreparedDigest> {
  const all = await loadComputeDeals();
  const views = await loadDealViews(week, all);
  const watch = (await db.select().from(investorsOfInterest)).map((i) => i.name);
  const compute = computeWeek({
    week,
    deals: all,
    sectors: Object.keys(blocks.taxonomy.sectors),
    settings: blocks.digest_settings,
    mandate: blocks.mandate,
    watchInvestors: watch,
  });
  const candidates = selectCandidates(views, compute, blocks.mandate, new Set(watch.map((w) => w.toLowerCase())), blocks.digest_settings.highlights_total);
  const companies = await listCompanies();
  const win = adjacencyWindow(week, istDay(), blocks.digest_settings.adjacency_window_days);
  const adjacency = computeAdjacency({
    deals: await loadAdjacencyDeals(win.from, win.to),
    portfolio: companies.filter((c) => c.tag === "Portfolio").map((c) => ({ id: c.id, name: c.name, sector: c.sector, description: c.description ?? null })),
    weekStart: week,
    today: istDay(),
    settings: blocks.digest_settings,
  });
  const scoreRows = views.length ? await db.select({ id: deals.id, score: deals.matchScore, reason: deals.matchReason }).from(deals).where(inArray(deals.id, views.map((v) => v.id))) : [];
  const needsReview: ReviewItem[] = views
    .filter((v) => v.needsReview)
    .map((v) => {
      const co = companies.find((c) => c.id === v.companyId);
      const s = scoreRows.find((r) => r.id === v.id);
      return {
        dealId: v.id,
        asWritten: v.companyName,
        closestCompany: co?.name ?? null,
        closestTag: co?.tag ?? null,
        score: s?.score ?? null,
        reason: "Close match, below the exact-match threshold",
        sources: v.sources.map((x) => ({ url: x.url, outlet: x.outlet })),
      };
    });
  return { week, compute, views, candidates, adjacency, needsReview, input: { week, compute, deals: views, candidates, mandate: blocks.mandate } };
}

export async function analyseDigest(prep: PreparedDigest, useAi: boolean): Promise<{ analysis: Analysis; highlights: Highlight[] }> {
  if (!prep.views.length) return { analysis: templateAnalysis(prep.input, "No deals this week.", "history"), highlights: [] };
  if (useAi) {
    try {
      return await geminiAnalyse(prep.input);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "failed";
      return { analysis: templateAnalysis(prep.input, `Gemini analysis was unavailable (${reason.slice(0, 160)}). This text was written from the numbers by a fixed template.`, "ai_unavailable"), highlights: prep.candidates };
    }
  }
  return { analysis: templateAnalysis(prep.input), highlights: prep.candidates };
}

export interface StoredHighlight {
  rank: number;
  dealId: number;
  why: string;
  reasons: string[];
  companyName: string;
  companyId: string | null;
  matchTag: string | null;
  sector: string;
  stage: string | null;
  amountText: string | null;
  amountUsd: number | null;
  amountInr: number | null;
  sources: { url: string; outlet: string | null }[];
}

export async function storeDigest(prep: PreparedDigest, analysis: Analysis, highlights: Highlight[], actions?: unknown): Promise<number> {
  const prevWeek = addDays(prep.week, -7);
  const all = await loadComputeDeals();
  const prev = all.filter((d) => d.weekStart === prevWeek);
  const adjacentDealIds = new Set(prep.adjacency.flatMap((g) => g.items.map((i) => i.dealId)));
  const kpis = {
    ...prep.compute.kpis,
    directHits: prep.compute.kpis.watchlistHits,
    adjacentHits: adjacentDealIds.size,
    adjacentClusters: prep.adjacency.filter((g) => g.cluster).length,
    week: prep.week,
    prevDeals: prev.length,
    prevDisclosedUsd: prev.reduce((a, d) => a + (d.amountUsd ?? 0), 0),
  };
  const byId = new Map(prep.views.map((v) => [v.id, v]));
  const stored: StoredHighlight[] = highlights.flatMap((h) => {
    const v = byId.get(h.dealId);
    if (!v) return [];
    return [
      {
        rank: h.rank,
        dealId: h.dealId,
        why: h.why,
        reasons: h.reasons,
        companyName: v.companyName,
        companyId: v.companyId,
        matchTag: v.needsReview ? null : v.matchTag,
        sector: v.sector,
        stage: v.stage,
        amountText: v.amountText,
        amountUsd: v.amountUsd,
        amountInr: v.amountInr,
        sources: v.sources.map((s) => ({ url: s.url, outlet: s.outlet })),
      },
    ];
  });
  const patterns = {
    computed: prep.compute,
    adjacency: prep.adjacency,
    needsReview: prep.needsReview,
    items: [
      { key: "capital", title: "Which sectors are attracting capital?", oneLine: analysis.capital.summary },
      { key: "momentum", title: "Is activity speeding up or slowing in the portfolio's spaces?", oneLine: analysis.momentum.summary },
      { key: "new_investors", title: "Has a new investor started moving in our target sectors?", oneLine: analysis.new_investors.summary },
    ],
  };
  const row = { weekStart: prep.week, kpis, highlights: stored, patterns, analysis, actions: actions ?? {} };
  const [saved] = await db
    .insert(digests)
    .values(row)
    .onConflictDoUpdate({ target: digests.weekStart, set: { kpis, highlights: stored, patterns, analysis, ...(actions === undefined ? {} : { actions }) } })
    .returning({ id: digests.id });
  return saved.id;
}

/**
 * Makes sure every week that has deals also has a digest (template text only, no AI cost), and refreshes
 * earlier template digests whose numbers have changed because more deals arrived. Digests written by Gemini
 * are left alone, except the one for `skipWeek`'s caller, which is rebuilt by the main run.
 */
export async function ensureTemplateDigests(blocks: ConfigBlocks, opts: { skipWeek?: string } = {}): Promise<number> {
  const weeks = await db.selectDistinct({ w: deals.weekStart }).from(deals);
  const existing = new Map((await db.select({ w: digests.weekStart, a: digests.analysis, k: digests.kpis }).from(digests)).map((d) => [d.w, d]));
  let n = 0;
  for (const { w } of weeks) {
    if (!w || w === opts.skipWeek) continue;
    const have = existing.get(w);
    // Template digests are cheap, so they are always rebuilt from the latest deals and match results.
    const stale = have && (have.a as Analysis).source === "template";
    if (have && !stale) continue;
    const prep = await prepareDigest(w, blocks);
    const { analysis, highlights } = await analyseDigest(prep, false);
    await storeDigest(prep, analysis, highlights, have ? undefined : {});
    n++;
  }
  return n;
}

export async function listDigestWeeks(): Promise<{ week: string; deals: number; source: string; emailedAt: Date | null }[]> {
  const rows = await db.select().from(digests).orderBy(desc(digests.weekStart));
  return rows.map((r) => ({ week: r.weekStart, deals: (r.kpis as { deals?: number }).deals ?? 0, source: (r.analysis as Analysis).source, emailedAt: r.emailedAt }));
}
