import "server-only";
import { and, count, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, dealInvestors, dealSources, deals, digests, investors } from "@/db/schema";
import { getBlocks } from "@/lib/config/store";
import { getState } from "@/lib/pipeline/runs";
import { listDigestWeeks } from "@/lib/pipeline/digest";
import { addDays, isValidDay } from "@/lib/time";
import { targetWeek } from "@/lib/pipeline/target-week";
import type { DealRowView, DigestView, QualityView } from "@/lib/view-types";
import type { AdjacentGroup } from "@/lib/pipeline/adjacency";
import type { WeekCompute } from "@/lib/pipeline/compute";
import { normalizeName } from "@/lib/matching";
import { containsForbidden, scrubDeep } from "@/lib/forbidden";
import { statedStageWords } from "@/lib/stage-words";

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
      .select({ dealId: dealSources.dealId, articleId: articles.id, url: articles.url, outlet: articles.outlet, title: articles.title, extracted: articles.extracted })
      .from(dealSources)
      .innerJoin(articles, eq(articles.id, dealSources.articleId))
      .where(inArray(dealSources.dealId, ids)),
  ]);
  // Only articles that claim a stage are read in full, to quote the outlet's own words.
  const claimIds = src.filter((s) => ((s.extracted as { stage?: string | null }[] | null) ?? []).some((e) => e.stage)).map((s) => s.articleId);
  const stageText = new Map<number, string>();
  if (claimIds.length) for (const t of await db.select({ id: articles.id, text: articles.text }).from(articles).where(inArray(articles.id, [...new Set(claimIds)]))) stageText.set(t.id, t.text ?? "");
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
      stageStatedBy: src
        .filter((s) => s.dealId === r.id)
        .flatMap((s) => {
          const claims = ((s.extracted as { company_name?: string; stage?: string | null }[] | null) ?? []).filter(
            (e) => e.stage && e.company_name && normalizeName(e.company_name) === normalizeName(r.companyName),
          );
          if (!claims.length) return [];
          // Quote the outlet's own words from its text; fall back to what was extracted.
          const said = statedStageWords(stageText.get(s.articleId) ?? "", r.companyName) ?? String(claims[0].stage);
          return [{ outlet: s.outlet, said }];
        })
        .filter((x, i, a) => a.findIndex((y) => y.outlet === x.outlet && y.said === x.said) === i),
      founders: (r.founders as DealRowView["founders"] | null) ?? [],
      investors: inv
        .filter((i) => i.dealId === r.id && !containsForbidden(i.name))
        .map((i) => ({ name: i.name, role: (i.role === "lead" ? "lead" : "participant") as "lead" | "participant", newInSector: newKey.has(`${r.id}::${normalizeName(i.name)}`) }))
        .sort((a, b) => Number(b.role === "lead") - Number(a.role === "lead")),
      sources: src.filter((s) => s.dealId === r.id && !s.url.startsWith("paste:")).map((s) => ({ url: s.url, outlet: s.outlet, title: s.title })),
      adjacentTo: adjacency.filter((g) => g.items.some((i) => i.dealId === r.id)).map((g) => ({ portfolioName: g.portfolioName, sharedTerms: g.items.find((i) => i.dealId === r.id)!.sharedTerms })),
    }))
    .sort((a, b) => (b.amountUsd ?? -1) - (a.amountUsd ?? -1) || a.companyName.localeCompare(b.companyName));
}

export async function loadQuality(week: string | null, dealsFound: number, undisclosed: number, needsReview: number): Promise<QualityView> {
  const settings = (await getBlocks()).digest_settings;
  const collect = await getState<{ at: string; total: number; reachable: number; unreachable: string[]; searchedInstead?: string[]; searchUnavailable?: boolean }>("last_collect");
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
    sources: collect ? { total: collect.total, reachable: collect.reachable, unreachable: collect.unreachable, searchedInstead: collect.searchedInstead ?? [] } : null,
    articlesRead,
    dealsFound,
    undisclosed,
    needsReview,
    lastUpdatedAt: last ? last.toISOString() : null,
    daysOld: last ? Math.floor((Date.now() - last.getTime()) / 86_400_000) : null,
    fresh: last ? Date.now() - last.getTime() < 24 * 3_600_000 : false,
    typicalVolume: { min: settings.typical_weekly_volume_min, max: settings.typical_weekly_volume_max },
    searchUnavailable: !!collect?.searchUnavailable,
    partialRun: !!run?.partial,
  };
}

/** Everything the page, the report and the emails show passes through here once. */
export async function loadDigestView(requestedWeek: string | null): Promise<DigestView> {
  return scrubDeep(await loadDigestViewRaw(requestedWeek));
}

async function loadDigestViewRaw(requestedWeek: string | null): Promise<DigestView> {
  const blocks = await getBlocks();
  const weeks = await listDigestWeeks();
  const defaultWeek = weeks.find((w) => w.week === targetWeek())?.week ?? weeks[0]?.week ?? null;
  const week = requestedWeek && isValidDay(requestedWeek) ? requestedWeek : defaultWeek;
  const [row] = week ? await db.select().from(digests).where(eq(digests.weekStart, week)).limit(1) : [];
  const patterns = row?.patterns as DigestView["digest"] extends infer D ? (D extends { patterns: infer P } ? P : never) : never;
  const dealRows = week && row ? await loadDealsForWeek(week, patterns?.computed?.newInvestors ?? [], patterns?.adjacency ?? []) : week ? await loadDealsForWeek(week, [], []) : [];
  const quality = await loadQuality(week, dealRows.length, dealRows.filter((d) => d.amountUsd === null).length, dealRows.filter((d) => d.needsReview).length);
  const allDigests = await db.select({ week: digests.weekStart, kpis: digests.kpis }).from(digests).orderBy(digests.weekStart);
  const history = allDigests
    .filter((d) => !week || d.week <= week)
    .slice(-8)
    .map((d) => ({ week: d.week, deals: Number((d.kpis as { deals?: number }).deals ?? 0), disclosedUsd: Number((d.kpis as { disclosedUsd?: number }).disclosedUsd ?? 0) }));
  return {
    weeks: weeks.map((w) => ({ ...w, emailedAt: w.emailedAt ? w.emailedAt.toISOString() : null })),
    week,
    history,
    defaultWeek,
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
