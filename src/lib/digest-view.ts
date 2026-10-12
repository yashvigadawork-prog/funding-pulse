import "server-only";
import { and, count, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, dealInvestors, dealSources, deals, digests, investors } from "@/db/schema";
import { getBlocks } from "@/lib/config/store";
import { getState } from "@/lib/pipeline/runs";
import { listDigestWeeks } from "@/lib/pipeline/digest";
import { addDays, isValidDay } from "@/lib/time";
import type { DealRowView, DigestView, QualityView } from "@/lib/view-types";
import type { AdjacentGroup } from "@/lib/pipeline/adjacency";
import type { WeekCompute } from "@/lib/pipeline/compute";
import { normalizeName } from "@/lib/matching";

export async function loadDealsForWeek(week: string, newInvestors: WeekCompute["newInvestors"], adjacency: AdjacentGroup[]): Promise<DealRowView[]> {
  const rows = await db.select().from(deals).where(eq(deals.weekStart, week));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [inv, src] = await Promise.all([
    db
      .select({ dealId: dealInvestors.dealId, name: investors.name, role: dealInvestors.role })
      .from(dealInvestors)
      .innerJoin(investors, eq(investors.id, dealInvestors.investorId))
      .where(inArray(dealInvestors.dealId, ids)),
    db
      .select({ dealId: dealSources.dealId, url: articles.url, outlet: articles.outlet, title: articles.title })
      .from(dealSources)
      .innerJoin(articles, eq(articles.id, dealSources.articleId))
      .where(inArray(dealSources.dealId, ids)),
  ]);
  const newKey = new Set(newInvestors.flatMap((n) => n.dealIds.map((id) => `${id}::${normalizeName(n.investor)}`)));
  return rows
    .map((r) => ({
      id: r.id,
      companyName: r.companyName,
      companyId: r.companyId,
      domain: r.domain,
      matchTag: (r.matchTag as DealRowView["matchTag"]) ?? null,
      matchReason: r.matchReason,
      needsReview: r.needsReview,
      sector: r.sector ?? "Other",
      stage: r.stage,
      amountText: r.amountText,
      amountUsd: r.amountUsd,
      amountInr: r.amountInr,
      amountMinUsd: r.amountMinUsd,
      amountMaxUsd: r.amountMaxUsd,
      announcedOn: r.announcedOn,
      confidence: r.confidence,
      summary: r.summary,
      founders: (r.founders as DealRowView["founders"] | null) ?? [],
      investors: inv
        .filter((i) => i.dealId === r.id)
        .map((i) => ({ name: i.name, role: (i.role === "lead" ? "lead" : "participant") as "lead" | "participant", newInSector: newKey.has(`${r.id}::${normalizeName(i.name)}`) }))
        .sort((a, b) => Number(b.role === "lead") - Number(a.role === "lead")),
      sources: src.filter((s) => s.dealId === r.id && !s.url.startsWith("paste:")).map((s) => ({ url: s.url, outlet: s.outlet, title: s.title })),
      adjacentTo: adjacency.filter((g) => g.items.some((i) => i.dealId === r.id)).map((g) => ({ portfolioName: g.portfolioName, sharedTerms: g.items.find((i) => i.dealId === r.id)!.sharedTerms })),
    }))
    .sort((a, b) => (b.amountUsd ?? -1) - (a.amountUsd ?? -1) || a.companyName.localeCompare(b.companyName));
}

export async function loadQuality(week: string | null, dealsFound: number, undisclosed: number, needsReview: number): Promise<QualityView> {
  const settings = (await getBlocks()).digest_settings;
  const collect = await getState<{ at: string; total: number; reachable: number; unreachable: string[]; searchUnavailable?: boolean }>("last_collect");
  const run = await getState<{ at: string; partial?: boolean }>("last_run");
  let articlesRead = 0;
  if (week) {
    const from = new Date(`${week}T00:00:00+05:30`);
    const to = new Date(`${addDays(week, 7)}T00:00:00+05:30`);
    const [row] = await db
      .select({ n: count() })
      .from(articles)
      .where(and(eq(articles.processed, true), gte(sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`, from), lt(sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`, to)));
    articlesRead = row?.n ?? 0;
  }
  const times = [collect?.at, run?.at].filter((x): x is string => !!x).map((x) => new Date(x).getTime());
  const last = times.length ? new Date(Math.max(...times)) : null;
  return {
    sources: collect ? { total: collect.total, reachable: collect.reachable, unreachable: collect.unreachable } : null,
    articlesRead,
    dealsFound,
    undisclosed,
    needsReview,
    lastUpdatedAt: last ? last.toISOString() : null,
    daysOld: last ? Math.floor((Date.now() - last.getTime()) / 86_400_000) : null,
    typicalVolume: { min: settings.typical_weekly_volume_min, max: settings.typical_weekly_volume_max },
    searchUnavailable: !!collect?.searchUnavailable,
    partialRun: !!run?.partial,
  };
}

export async function loadDigestView(requestedWeek: string | null): Promise<DigestView> {
  const blocks = await getBlocks();
  const weeks = await listDigestWeeks();
  const week = requestedWeek && isValidDay(requestedWeek) ? requestedWeek : (weeks[0]?.week ?? null);
  const [row] = week ? await db.select().from(digests).where(eq(digests.weekStart, week)).limit(1) : [];
  const patterns = row?.patterns as DigestView["digest"] extends infer D ? (D extends { patterns: infer P } ? P : never) : never;
  const dealRows = week && row ? await loadDealsForWeek(week, patterns?.computed?.newInvestors ?? [], patterns?.adjacency ?? []) : week ? await loadDealsForWeek(week, [], []) : [];
  const quality = await loadQuality(week, dealRows.length, dealRows.filter((d) => d.amountUsd === null).length, dealRows.filter((d) => d.needsReview).length);
  return {
    weeks: weeks.map((w) => ({ ...w, emailedAt: w.emailedAt ? w.emailedAt.toISOString() : null })),
    week,
    digest: row
      ? {
          kpis: row.kpis as NonNullable<DigestView["digest"]>["kpis"],
          highlights: row.highlights as NonNullable<DigestView["digest"]>["highlights"],
          patterns,
          analysis: row.analysis as NonNullable<DigestView["digest"]>["analysis"],
          actions: row.actions as NonNullable<DigestView["digest"]>["actions"],
          emailedAt: row.emailedAt ? row.emailedAt.toISOString() : null,
          createdAt: row.createdAt.toISOString(),
        }
      : null,
    deals: dealRows,
    quality,
    fundName: blocks.fund_profile.name,
  };
}
