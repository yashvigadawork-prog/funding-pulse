import "server-only";
import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, dealSources, deals, digests, matchAudit, runs } from "@/db/schema";
import { getState, latestRun } from "@/lib/pipeline/runs";
import type { Analysis } from "@/lib/pipeline/analyse";
import type { WeekCompute } from "@/lib/pipeline/compute";

export interface Example {
  text: string;
  url?: string | null;
  outlet?: string | null;
}
export interface EdgeCase {
  id: string;
  problem: string;
  behaviour: string;
  /** null means there is no real example in the current data. We never invent one. */
  example: Example | null;
  extra?: string;
}

async function firstSource(dealId: number): Promise<{ url: string; outlet: string | null } | null> {
  const [s] = await db
    .select({ url: articles.url, outlet: articles.outlet })
    .from(dealSources)
    .innerJoin(articles, eq(articles.id, dealSources.articleId))
    .where(eq(dealSources.dealId, dealId))
    .limit(1);
  return s && !s.url.startsWith("paste:") ? s : null;
}

export async function loadEdgeCases(): Promise<EdgeCase[]> {
  const out: EdgeCase[] = [];
  const safe = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch {
      return null;
    }
  };

  const undisclosed = await safe(async () => (await db.select().from(deals).where(and(sql`${deals.amountUsd} is null`, isNotNull(deals.announcedOn))).orderBy(desc(deals.announcedOn)).limit(1))[0]);
  out.push({
    id: "undisclosed",
    problem: "The amount was not disclosed",
    behaviour: "Shown as “Undisclosed”, counted as a deal, listed separately and never added into capital totals.",
    example: undisclosed ? { text: `${undisclosed.companyName}: amount as reported “${undisclosed.amountText ?? "not stated"}”`, ...(await firstSource(undisclosed.id)) } : null,
  });

  const merged = await safe(async () => {
    const rows = await db.select({ dealId: dealSources.dealId, n: count() }).from(dealSources).groupBy(dealSources.dealId).having(sql`count(*) > 1`).orderBy(desc(count())).limit(1);
    if (!rows.length) return null;
    const [d] = await db.select().from(deals).where(eq(deals.id, rows[0].dealId)).limit(1);
    const srcs = await db.select({ url: articles.url, outlet: articles.outlet }).from(dealSources).innerJoin(articles, eq(articles.id, dealSources.articleId)).where(eq(dealSources.dealId, d.id));
    return { d, srcs, n: rows[0].n };
  });
  out.push({
    id: "merged",
    problem: "The same deal is reported by several outlets",
    behaviour: "Merged into one deal (same company, same round, dates within 14 days). Every source link is kept.",
    example: merged ? { text: `${merged.d.companyName}: ${merged.n} sources (${merged.srcs.map((s) => s.outlet).filter(Boolean).join(", ")})`, url: merged.srcs[0]?.url, outlet: merged.srcs[0]?.outlet } : null,
  });

  const disagree = await safe(async () => (await db.select().from(deals).where(isNotNull(deals.amountMinUsd)).orderBy(desc(deals.announcedOn)).limit(1))[0]);
  out.push({
    id: "disagree",
    problem: "Outlets disagree on the amount",
    behaviour: "The range is kept, the middle value is used for totals, and confidence is lowered to “low”.",
    example: disagree ? { text: `${disagree.companyName}: reported as ${disagree.amountText}. Confidence ${disagree.confidence}.`, ...(await firstSource(disagree.id)) } : null,
  });

  const audit = await safe(async () => {
    const [{ n }] = await db.select({ n: count() }).from(matchAudit);
    const [latest] = await db.select().from(matchAudit).orderBy(desc(matchAudit.id)).limit(1);
    return { n, latest };
  });
  out.push({
    id: "ambiguous",
    problem: "A company name is shared with other companies (for example Jupiter)",
    behaviour: "The name only counts as a match when one of its context words (for example “neobank”) appears near it. Every blocked match is recorded.",
    example: audit?.latest ? { text: `Blocked ${audit.n} look-alike match${audit.n === 1 ? "" : "es"} recently. Latest: “${audit.latest.company}”, article text: “${audit.latest.snippet ?? ""}”`, url: audit.latest.articleUrl } : null,
  });

  const review = await safe(async () => (await db.select().from(deals).where(eq(deals.needsReview, true)).orderBy(desc(deals.announcedOn)).limit(1))[0]);
  out.push({
    id: "review",
    problem: "A name nearly matches a Portfolio or On Radar company",
    behaviour: "Flagged “needs review” and listed on the dashboard with its similarity score. It is not silently accepted.",
    example: review ? { text: `${review.companyName}: ${review.matchReason ?? "close match"}`, ...(await firstSource(review.id)) } : null,
  });

  const latestDigest = await safe(async () => (await db.select().from(digests).orderBy(desc(digests.weekStart)).limit(1))[0]);
  const history = latestDigest ? (latestDigest.patterns as { computed?: WeekCompute }).computed?.trends.find((t) => t.status === "not_enough_history") : null;
  out.push({
    id: "history",
    problem: "A sector has too little history to judge a trend",
    behaviour: "Labelled “not enough history”. Nothing is called speeding up or slowing.",
    example: history ? { text: `Week of ${latestDigest!.weekStart}: ${history.sector} had ${history.baselineTotal} baseline deals, below the minimum set in Settings.` } : null,
  });

  const collect = await safe(() => getState<{ at: string; total: number; reachable: number; unreachable: string[] }>("last_collect"));
  out.push({
    id: "unreachable",
    problem: "A news source cannot be reached",
    behaviour: "It is skipped, the page keeps working, and the data quality line shows “N of M sources reachable”.",
    example: collect && collect.unreachable.length ? { text: `Last collection: ${collect.reachable} of ${collect.total} reachable. Could not reach: ${collect.unreachable.join(", ")}.` } : null,
  });

  const analysis = latestDigest ? (latestDigest.analysis as Analysis) : null;
  out.push({
    id: "gemini",
    problem: "The AI service is unavailable or its answer fails the checks",
    behaviour: "A plain template is written from the computed numbers and a banner says so. The numbers are unaffected.",
    example: analysis?.source === "template" ? { text: `Week of ${latestDigest!.weekStart}: ${analysis.note ?? "template analysis used"}` } : null,
  });

  const partial = await safe(async () => (await db.select().from(runs).where(eq(runs.status, "partial")).orderBy(desc(runs.id)).limit(1))[0]);
  out.push({
    id: "partial",
    problem: "A run ran out of time or quota before finishing",
    behaviour: "Work done so far is saved. The page says some articles are still waiting, and the next refresh carries on.",
    example: partial ? { text: `${partial.step}: ${partial.message ?? ""}` } : null,
  });
  return out;
}

export interface RunLogStep {
  step: string;
  status: string;
  message: string | null;
  seconds: number | null;
}

export async function loadLatestRunLog(): Promise<{ runId: string; kind: string; startedAt: Date; steps: RunLogStep[] } | null> {
  try {
    const latest = await latestRun();
    if (!latest) return null;
    const rows = await db.select().from(runs).where(eq(runs.runId, latest.runId)).orderBy(runs.id);
    return {
      runId: latest.runId,
      kind: latest.kind,
      startedAt: latest.startedAt,
      steps: rows.map((r) => ({ step: r.step, status: r.status, message: r.message, seconds: r.finishedAt ? Math.max(0, Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 100) / 10) : null })),
    };
  } catch {
    return null;
  }
}
