/**
 * All statistics live here. They are plain arithmetic on stored deals (never Gemini), and every
 * threshold comes from the digest settings passed in.
 */
import { normalizeName } from "@/lib/matching";
import { addDays } from "@/lib/time";
import type { DigestSettings, Mandate } from "@/lib/config/schema";

export interface ComputeDeal {
  id: number;
  companyName: string;
  companyId: string | null;
  matchTag: "Portfolio" | "On Radar" | null;
  needsReview: boolean;
  sector: string;
  stage: string | null;
  amountUsd: number | null;
  amountInr: number | null;
  announcedOn: string;
  weekStart: string;
  investors: { name: string; role: "lead" | "participant" }[];
}

export type TrendStatus = "accelerating" | "slowing" | "steady" | "not_enough_history";

export interface SectorCapital {
  sector: string;
  deals: number;
  disclosedUsd: number;
  disclosedInr: number;
  disclosedCount: number;
  undisclosed: { id: number; companyName: string }[];
  baselineAvgUsd: number;
}

export interface SectorTrend {
  sector: string;
  isFocus: boolean;
  thisWeek: number;
  baselineTotal: number;
  baselineAvg: number;
  ratio: number | null;
  extra: number;
  status: TrendStatus;
  series: { week: string; deals: number }[];
}

export interface NewInvestorEntry {
  investor: string;
  sector: string;
  dealIds: number[];
  onWatchlist: boolean;
}

export interface WeekCompute {
  week: string;
  dealIds: number[];
  kpis: {
    deals: number;
    disclosedUsd: number;
    disclosedInr: number;
    undisclosedCount: number;
    topSector: string | null;
    topSectorUsd: number | null;
    watchlistHits: number;
    newInvestors: number;
    needsReview: number;
  };
  capital: SectorCapital[];
  trends: SectorTrend[];
  otherSectorsToNote: SectorTrend[];
  focusDealIds: number[];
  watchlistHits: { dealId: number; tag: "Portfolio" | "On Radar"; companyName: string }[];
  newInvestors: NewInvestorEntry[];
  sectorsWithoutHistory: string[];
}

export type TrendSettings = Pick<DigestSettings, "baseline_weeks" | "acceleration_ratio" | "slowing_ratio" | "min_baseline_deals" | "min_extra_deals">;

/** "Existing investors", "angel investors", "undisclosed" and similar are not named investors. */
export function isPlaceholderInvestor(name: string): boolean {
  return /^(an? |the |some |several |other |existing |undisclosed |unnamed |various |multiple |family offices?|angel investors?|angels?\b|investors?\b|hnis?\b|individual|institutional|strategic)/i.test(name.trim()) || /^(others?|undisclosed|n\/a|na)$/i.test(name.trim());
}

export function isFocusDeal(d: Pick<ComputeDeal, "sector" | "stage" | "matchTag">, mandate: Mandate): boolean {
  if (!mandate.focus_sectors.includes(d.sector)) return false;
  const stage = mandate.stages.find((s) => s.name === d.stage);
  if (!stage) return false;
  if (stage.focus) return true;
  if (stage.follow_on_only) return d.matchTag !== null;
  return false;
}

export function classifyTrend(
  thisWeek: number,
  baselineTotal: number,
  s: TrendSettings,
): { status: TrendStatus; avg: number; ratio: number | null; extra: number } {
  const avg = baselineTotal / s.baseline_weeks;
  const extra = thisWeek - avg;
  const ratio = avg > 0 ? thisWeek / avg : null;
  if (baselineTotal < s.min_baseline_deals) return { status: "not_enough_history", avg, ratio, extra };
  if (thisWeek >= s.acceleration_ratio * avg && extra >= s.min_extra_deals) return { status: "accelerating", avg, ratio, extra };
  if (thisWeek <= s.slowing_ratio * avg) return { status: "slowing", avg, ratio, extra };
  return { status: "steady", avg, ratio, extra };
}

export function computeWeek(p: {
  week: string;
  deals: ComputeDeal[];
  sectors: string[];
  settings: TrendSettings;
  mandate: Mandate;
  watchInvestors: string[];
}): WeekCompute {
  const { week, settings, mandate } = p;
  const thisWeek = p.deals.filter((d) => d.weekStart === week);
  const history = p.deals.filter((d) => d.weekStart < week);
  const baselineWeeks = Array.from({ length: settings.baseline_weeks }, (_, i) => addDays(week, -7 * (i + 1))).reverse();
  const baselineSet = new Set(baselineWeeks);
  const sectorSet = new Set([...p.sectors, ...thisWeek.map((d) => d.sector)]);

  // ---- capital per sector
  const capital: SectorCapital[] = [];
  for (const sector of sectorSet) {
    const rows = thisWeek.filter((d) => d.sector === sector);
    const disclosed = rows.filter((d) => d.amountUsd !== null);
    const baselineUsd = p.deals.filter((d) => d.sector === sector && baselineSet.has(d.weekStart) && d.amountUsd !== null).reduce((a, d) => a + (d.amountUsd ?? 0), 0);
    capital.push({
      sector,
      deals: rows.length,
      disclosedUsd: disclosed.reduce((a, d) => a + (d.amountUsd ?? 0), 0),
      disclosedInr: disclosed.reduce((a, d) => a + (d.amountInr ?? 0), 0),
      disclosedCount: disclosed.length,
      undisclosed: rows.filter((d) => d.amountUsd === null).map((d) => ({ id: d.id, companyName: d.companyName })),
      baselineAvgUsd: baselineUsd / settings.baseline_weeks,
    });
  }
  capital.sort((a, b) => b.disclosedUsd - a.disclosedUsd || b.deals - a.deals || a.sector.localeCompare(b.sector));

  // ---- trends per sector
  const trends: SectorTrend[] = [];
  for (const sector of sectorSet) {
    const count = (w: string) => p.deals.filter((d) => d.sector === sector && d.weekStart === w).length;
    const baselineTotal = baselineWeeks.reduce((a, w) => a + count(w), 0);
    const now = count(week);
    const c = classifyTrend(now, baselineTotal, settings);
    trends.push({
      sector,
      isFocus: mandate.focus_sectors.includes(sector),
      thisWeek: now,
      baselineTotal,
      baselineAvg: c.avg,
      ratio: c.ratio,
      extra: c.extra,
      status: c.status,
      series: [...baselineWeeks, week].map((w) => ({ week: w, deals: count(w) })),
    });
  }
  trends.sort((a, b) => Number(b.isFocus) - Number(a.isFocus) || a.sector.localeCompare(b.sector));

  // ---- new investors (new in our records, per sector)
  const seenBefore = new Map<string, Set<string>>(); // sector -> normalised investor names
  const historyCount = new Map<string, number>();
  for (const d of history) {
    historyCount.set(d.sector, (historyCount.get(d.sector) ?? 0) + 1);
    const set = seenBefore.get(d.sector) ?? new Set<string>();
    for (const i of d.investors) set.add(normalizeName(i.name));
    seenBefore.set(d.sector, set);
  }
  const watch = new Set(p.watchInvestors.map(normalizeName));
  const sectorsWithoutHistory: string[] = [];
  const newMap = new Map<string, NewInvestorEntry>();
  for (const d of thisWeek) {
    if (!mandate.focus_sectors.includes(d.sector)) continue; // "target verticals" only
    if ((historyCount.get(d.sector) ?? 0) < settings.min_baseline_deals) {
      if (d.investors.length && !sectorsWithoutHistory.includes(d.sector)) sectorsWithoutHistory.push(d.sector);
      continue;
    }
    const known = seenBefore.get(d.sector) ?? new Set<string>();
    for (const i of d.investors) {
      const n = normalizeName(i.name);
      if (!n || known.has(n) || isPlaceholderInvestor(i.name)) continue;
      const key = `${d.sector}::${n}`;
      const e = newMap.get(key) ?? { investor: i.name, sector: d.sector, dealIds: [], onWatchlist: watch.has(n) };
      if (!e.dealIds.includes(d.id)) e.dealIds.push(d.id);
      newMap.set(key, e);
    }
  }
  const newInvestors = [...newMap.values()].sort((a, b) => Number(b.onWatchlist) - Number(a.onWatchlist) || a.sector.localeCompare(b.sector) || a.investor.localeCompare(b.investor));

  // ---- the rest
  // A near-miss name (needs review) is not treated as a confirmed watchlist company.
  const confirmed = (d: ComputeDeal) => (d.needsReview ? null : d.matchTag);
  const focusDealIds = thisWeek.filter((d) => isFocusDeal({ sector: d.sector, stage: d.stage, matchTag: confirmed(d) }, mandate)).map((d) => d.id);
  const watchlistHits = thisWeek
    .filter((d): d is ComputeDeal & { matchTag: "Portfolio" | "On Radar" } => confirmed(d) !== null)
    .map((d) => ({ dealId: d.id, tag: d.matchTag, companyName: d.companyName }));
  const disclosedUsd = thisWeek.reduce((a, d) => a + (d.amountUsd ?? 0), 0);
  const disclosedInr = thisWeek.reduce((a, d) => a + (d.amountInr ?? 0), 0);
  // "Other" is a catch-all bucket, so it only leads when nothing else has deals.
  const named = capital.filter((c) => c.sector !== "Other");
  const top = named.find((c) => c.disclosedUsd > 0) ?? capital.find((c) => c.disclosedUsd > 0 && named.every((n) => n.deals === 0)) ?? [...named].sort((a, b) => b.deals - a.deals)[0] ?? capital[0];

  return {
    week,
    dealIds: thisWeek.map((d) => d.id),
    kpis: {
      deals: thisWeek.length,
      disclosedUsd,
      disclosedInr,
      undisclosedCount: thisWeek.filter((d) => d.amountUsd === null).length,
      topSector: top && top.deals > 0 ? top.sector : null,
      topSectorUsd: top && top.disclosedUsd > 0 ? top.disclosedUsd : null,
      watchlistHits: watchlistHits.length,
      newInvestors: new Set(newInvestors.map((n) => normalizeName(n.investor))).size,
      needsReview: thisWeek.filter((d) => d.needsReview).length,
    },
    capital,
    trends,
    otherSectorsToNote: mandate.other_sectors_to_note ? trends.filter((t) => !t.isFocus && (t.status === "accelerating" || t.status === "slowing")) : [],
    focusDealIds,
    watchlistHits,
    newInvestors,
    sectorsWithoutHistory,
  };
}
