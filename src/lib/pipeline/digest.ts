/** Building a week's digest: compute (code) -> analyse (Gemini or template) -> store. */
import { asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, dealInvestors, dealSources, deals, digests, investors, investorsOfInterest } from "@/db/schema";
import type { ConfigBlocks } from "@/lib/config/store";
import { normalizeName } from "@/lib/matching";
import { addDays } from "@/lib/time";
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
      sources: mine.map((s) => ({ n: s.id, url: s.url, outlet: s.outlet, title: s.title })),
      excerpt: excerptAround((mine[0]?.text ?? pasted[0]?.text ?? r.summary ?? ""), r.companyName),
      novel: !earlier.has(normalizeName(r.companyName)),
    };
  });
}

export interface PreparedDigest {
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
  return { week, compute, views, candidates, input: { week, compute, deals: views, candidates, mandate: blocks.mandate } };
}

export async function analyseDigest(prep: PreparedDigest, useAi: boolean): Promise<{ analysis: Analysis; highlights: Highlight[] }> {
  if (!prep.views.length) return { analysis: templateAnalysis(prep.input, "No deals this week."), highlights: [] };
  if (useAi) {
    try {
      return await geminiAnalyse(prep.input);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "failed";
      return { analysis: templateAnalysis(prep.input, `Gemini analysis was unavailable (${reason.slice(0, 160)}). This text was written from the numbers by a fixed template.`), highlights: prep.candidates };
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

export async function storeDigest(prep: PreparedDigest, analysis: Analysis, highlights: Highlight[], actions: unknown = {}): Promise<number> {
  const prevWeek = addDays(prep.week, -7);
  const all = await loadComputeDeals();
  const prev = all.filter((d) => d.weekStart === prevWeek);
  const kpis = {
    ...prep.compute.kpis,
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
        matchTag: v.matchTag,
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
    items: [
      { key: "capital", title: "Which sectors are attracting capital?", oneLine: analysis.capital.summary },
      { key: "momentum", title: "Is activity speeding up or slowing in the portfolio's spaces?", oneLine: analysis.momentum.summary },
      { key: "new_investors", title: "Has a new investor started moving in our target sectors?", oneLine: analysis.new_investors.summary },
    ],
  };
  const row = { weekStart: prep.week, kpis, highlights: stored, patterns, analysis, actions };
  const [saved] = await db
    .insert(digests)
    .values(row)
    .onConflictDoUpdate({ target: digests.weekStart, set: { kpis, highlights: stored, patterns, analysis, actions } })
    .returning({ id: digests.id });
  return saved.id;
}

/** Makes sure every week that has deals also has a digest (template text only, no AI cost). */
export async function ensureTemplateDigests(blocks: ConfigBlocks, onlyBefore?: string): Promise<number> {
  const weeks = await db.selectDistinct({ w: deals.weekStart }).from(deals).where(onlyBefore ? lt(deals.weekStart, onlyBefore) : sql`true`);
  const have = new Set((await db.select({ w: digests.weekStart }).from(digests)).map((d) => d.w));
  let n = 0;
  for (const { w } of weeks) {
    if (!w || have.has(w)) continue;
    const prep = await prepareDigest(w, blocks);
    const { analysis, highlights } = await analyseDigest(prep, false);
    await storeDigest(prep, analysis, highlights);
    n++;
  }
  return n;
}

export async function listDigestWeeks(): Promise<{ week: string; deals: number; source: string; emailedAt: Date | null }[]> {
  const rows = await db.select().from(digests).orderBy(desc(digests.weekStart));
  return rows.map((r) => ({ week: r.weekStart, deals: (r.kpis as { deals?: number }).deals ?? 0, source: (r.analysis as Analysis).source, emailedAt: r.emailedAt }));
}
