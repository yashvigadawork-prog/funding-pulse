/**
 * Process: turn extracted deals into stored deals.
 * Order: normalise -> deduplicate (also against stored deals) -> match against Portfolio and On Radar -> save.
 */
import { and, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, dealInvestors, dealSources, deals, investors, type Article } from "@/db/schema";
import type { CompanyJson } from "@/lib/config/schema";
import type { ConfigBlocks } from "@/lib/config/store";
import { matchCompany, type MatchCandidate } from "@/lib/matching";
import { addDays, weekStartOfDay } from "@/lib/time";
import { chooseDealDate } from "./dates";
import { dedupeDeals, DEDUPE_WINDOW_DAYS, mergeTwo, sameRound, type DealLike } from "./dedupe";
import type { ExtractedDeal } from "./extract";
import { normaliseStage, resolveAmount, resolveSector } from "./normalise";

export function toCandidates(companies: CompanyJson[]): MatchCandidate[] {
  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    tag: c.tag,
    aliases: c.aliases ?? [],
    matchRequiresContext: c.match_requires_context ?? [],
  }));
}

/** Turns one Gemini deal into a normalised candidate. All arithmetic happens here, in code. */
export function normaliseExtracted(d: ExtractedDeal, article: Pick<Article, "id" | "publishedAt" | "title" | "kind">, blocks: Pick<ConfigBlocks, "taxonomy" | "fund_profile">): DealLike {
  const { usd, inr } = resolveAmount({ amountText: d.amount_text, value: d.amount_value, unit: d.amount_unit, currency: d.currency }, blocks.fund_profile.usd_inr_rate);
  return {
    companyName: d.company_name.trim(),
    domain: d.company_domain ? d.company_domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") : null,
    stage: normaliseStage(d.stage, blocks.taxonomy.stages),
    sector: resolveSector(d.sector, `${d.company_name} ${d.summary ?? ""}`, blocks.taxonomy.sectors),
    announcedOn: chooseDealDate({ statedOn: d.announced_on, publishedAt: article.publishedAt, title: article.title ?? "", kind: article.kind }),
    amountUsd: usd,
    amountInr: inr,
    amountMinUsd: null,
    amountMaxUsd: null,
    amountText: d.amount_text,
    summary: d.summary,
    founders: d.founders.map((f) => ({ name: f.name, role: f.role })),
    investors: [
      ...d.lead_investors.map((name) => ({ name, role: "lead" as const })),
      ...d.other_investors.map((name) => ({ name, role: "participant" as const })),
    ],
    articleIds: [article.id],
    confidence: "medium",
  };
}

interface StoredDeal extends DealLike {
  id: number;
}

async function loadStored(from: string, to: string): Promise<StoredDeal[]> {
  const rows = await db.select().from(deals).where(and(gte(deals.announcedOn, from), lte(deals.announcedOn, to)));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [inv, src] = await Promise.all([
    db
      .select({ dealId: dealInvestors.dealId, name: investors.name, role: dealInvestors.role })
      .from(dealInvestors)
      .innerJoin(investors, eq(investors.id, dealInvestors.investorId))
      .where(inArray(dealInvestors.dealId, ids)),
    db.select().from(dealSources).where(inArray(dealSources.dealId, ids)),
  ]);
  return rows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    domain: r.domain,
    stage: r.stage ?? "Unknown",
    sector: r.sector ?? "Other",
    announcedOn: r.announcedOn ?? addDays(new Date().toISOString().slice(0, 10), 0),
    amountUsd: r.amountUsd,
    amountInr: r.amountInr,
    amountMinUsd: r.amountMinUsd,
    amountMaxUsd: r.amountMaxUsd,
    amountText: r.amountText,
    summary: r.summary,
    founders: (r.founders as { name: string; role?: string | null }[] | null) ?? [],
    investors: inv.filter((i) => i.dealId === r.id).map((i) => ({ name: i.name, role: i.role === "lead" ? ("lead" as const) : ("participant" as const) })),
    articleIds: src.filter((s) => s.dealId === r.id).map((s) => s.articleId),
    confidence: (r.confidence as DealLike["confidence"]) ?? "medium",
  }));
}

async function upsertInvestors(names: string[], firstSeen: string): Promise<Map<string, number>> {
  const clean = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  const map = new Map<string, number>();
  if (!clean.length) return map;
  const existing = await db.select().from(investors).where(inArray(sql`lower(${investors.name})`, clean.map((n) => n.toLowerCase())));
  for (const e of existing) map.set(e.name.toLowerCase(), e.id);
  const missing = clean.filter((n) => !map.has(n.toLowerCase()));
  if (missing.length) {
    const ins = await db.insert(investors).values(missing.map((name) => ({ name, firstSeen }))).onConflictDoNothing().returning();
    for (const i of ins) map.set(i.name.toLowerCase(), i.id);
    const again = await db.select().from(investors).where(inArray(investors.name, missing));
    for (const i of again) map.set(i.name.toLowerCase(), i.id);
  }
  // keep the earliest date we have ever seen each investor
  await db.update(investors).set({ firstSeen }).where(and(inArray(sql`lower(${investors.name})`, clean.map((n) => n.toLowerCase())), sql`(${investors.firstSeen} is null or ${investors.firstSeen} > ${firstSeen})`));
  return map;
}

async function writeDeal(id: number | null, d: DealLike, match: ReturnType<typeof matchCompany>): Promise<number> {
  const values = {
    companyName: d.companyName,
    companyId: match.company?.id ?? null,
    matchTag: match.company?.tag ?? null,
    matchReason: match.company ? match.reason : null,
    needsReview: match.company ? match.needsReview : false,
    stage: d.stage,
    amountUsd: d.amountUsd,
    amountInr: d.amountInr,
    amountMinUsd: d.amountMinUsd,
    amountMaxUsd: d.amountMaxUsd,
    amountText: d.amountText,
    sector: d.sector,
    announcedOn: d.announcedOn,
    weekStart: weekStartOfDay(d.announcedOn),
    confidence: d.confidence,
    summary: d.summary,
    domain: d.domain,
    founders: d.founders,
    dedupeKey: d.companyName.toLowerCase(),
  };
  let dealId = id;
  if (dealId === null) {
    const [row] = await db.insert(deals).values(values).returning({ id: deals.id });
    dealId = row.id;
  } else {
    await db.update(deals).set(values).where(eq(deals.id, dealId));
  }
  if (d.articleIds.length) await db.insert(dealSources).values(d.articleIds.map((articleId) => ({ dealId: dealId!, articleId }))).onConflictDoNothing();
  if (d.investors.length) {
    const ids = await upsertInvestors(d.investors.map((i) => i.name), d.announcedOn);
    const rows = d.investors
      .map((i) => ({ dealId: dealId!, investorId: ids.get(i.name.trim().toLowerCase()), role: i.role }))
      .filter((r): r is { dealId: number; investorId: number; role: "lead" | "participant" } => r.investorId !== undefined);
    if (rows.length)
      await db
        .insert(dealInvestors)
        .values(rows)
        .onConflictDoUpdate({ target: [dealInvestors.dealId, dealInvestors.investorId], set: { role: sql`case when excluded.role = 'lead' then 'lead' else ${dealInvestors.role} end` } });
  }
  return dealId;
}

export interface ProcessResult {
  articlesProcessed: number;
  candidates: number;
  inserted: number;
  merged: number;
  watchlistMatches: number;
  needsReview: number;
}

export async function processExtracted(p: { blocks: ConfigBlocks; companies: CompanyJson[] }): Promise<ProcessResult> {
  const rows = await db.select().from(articles).where(and(isNotNull(articles.extracted), eq(articles.processed, false)));
  const result: ProcessResult = { articlesProcessed: 0, candidates: 0, inserted: 0, merged: 0, watchlistMatches: 0, needsReview: 0 };
  if (!rows.length) return result;

  const candidates: DealLike[] = [];
  const textByArticle = new Map<number, string>();
  for (const a of rows) {
    textByArticle.set(a.id, a.text ?? "");
    for (const raw of (a.extracted as ExtractedDeal[]) ?? []) {
      // stored values already passed validation, but guard against an empty name anyway
      if (!raw?.company_name) continue;
      candidates.push(normaliseExtracted(raw, a, p.blocks));
    }
  }
  result.candidates = candidates.length;
  const unique = dedupeDeals(candidates);

  const matchable = toCandidates(p.companies);
  const threshold = p.blocks.digest_settings.fuzzy_match_review_threshold;

  if (unique.length) {
    const dates = unique.map((d) => d.announcedOn).sort();
    const stored = await loadStored(addDays(dates[0], -DEDUPE_WINDOW_DAYS), addDays(dates[dates.length - 1], DEDUPE_WINDOW_DAYS));
    for (const d of unique) {
      const hit = stored.find((s) => sameRound(s, d));
      const combined = hit ? mergeTwo(hit, d) : d;
      const context = `${combined.summary ?? ""}\n${combined.articleIds.map((i) => textByArticle.get(i) ?? "").join("\n")}`.slice(0, 12_000);
      const match = matchCompany({ name: combined.companyName, context }, matchable, { fuzzyThreshold: threshold });
      const id = await writeDeal(hit?.id ?? null, combined, match);
      if (hit) {
        result.merged++;
        Object.assign(hit, combined);
      } else {
        result.inserted++;
        stored.push({ ...combined, id });
      }
      if (match.company) result.watchlistMatches++;
      if (match.company && match.needsReview) result.needsReview++;
    }
  }
  await db.update(articles).set({ processed: true }).where(inArray(articles.id, rows.map((r) => r.id)));
  result.articlesProcessed = rows.length;
  return result;
}

/** Re-checks recent deals against the current Portfolio and On Radar lists (the lists may have been edited). */
export async function rematchRecent(p: { blocks: ConfigBlocks; companies: CompanyJson[]; sinceDay: string }): Promise<{ checked: number; changed: number }> {
  const rows = await db.select().from(deals).where(gte(deals.announcedOn, p.sinceDay));
  if (!rows.length) return { checked: 0, changed: 0 };
  const src = await db
    .select({ dealId: dealSources.dealId, text: articles.text })
    .from(dealSources)
    .innerJoin(articles, eq(articles.id, dealSources.articleId))
    .where(inArray(dealSources.dealId, rows.map((r) => r.id)));
  const matchable = toCandidates(p.companies);
  let changed = 0;
  for (const r of rows) {
    const context = `${r.summary ?? ""}\n${src.filter((s) => s.dealId === r.id).map((s) => (s.text ?? "").slice(0, 6000)).join("\n")}`;
    const m = matchCompany({ name: r.companyName, context }, matchable, { fuzzyThreshold: p.blocks.digest_settings.fuzzy_match_review_threshold });
    const next = { companyId: m.company?.id ?? null, matchTag: m.company?.tag ?? null, matchReason: m.company ? m.reason : null, needsReview: m.company ? m.needsReview : false };
    if (next.companyId !== r.companyId || next.matchTag !== r.matchTag || next.needsReview !== r.needsReview) {
      await db.update(deals).set(next).where(eq(deals.id, r.id));
      changed++;
    }
  }
  return { checked: rows.length, changed };
}
