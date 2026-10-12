/**
 * Deduplication: the same company, same round and nearby dates reported by several outlets become one deal
 * with every source link kept. If outlets disagree on the amount we keep the range and lower confidence.
 */
import { normalizeName } from "@/lib/matching";
import { daysBetween } from "@/lib/time";

export type Confidence = "high" | "medium" | "low";

export interface DealLike {
  companyName: string;
  domain: string | null;
  stage: string;
  sector: string;
  announcedOn: string; // YYYY-MM-DD
  amountUsd: number | null;
  amountInr: number | null;
  amountMinUsd: number | null;
  amountMaxUsd: number | null;
  amountText: string | null;
  summary: string | null;
  founders: { name: string; role?: string | null }[];
  investors: { name: string; role: "lead" | "participant" }[];
  articleIds: number[];
  confidence: Confidence;
}

export const DEDUPE_WINDOW_DAYS = 14;
const AMOUNT_TOLERANCE = 0.05;

const stageCompatible = (a: string, b: string) => a === b || a === "Unknown" || b === "Unknown";

export function sameRound(a: DealLike, b: DealLike, windowDays = DEDUPE_WINDOW_DAYS): boolean {
  const na = normalizeName(a.companyName);
  const nb = normalizeName(b.companyName);
  const sameCompany = (!!na && na === nb) || (!!a.domain && !!b.domain && a.domain.toLowerCase() === b.domain.toLowerCase());
  if (!sameCompany) return false;
  if (!stageCompatible(a.stage, b.stage)) return false;
  return Math.abs(daysBetween(a.announcedOn, b.announcedOn)) <= windowDays;
}

function median(xs: number[]): number {
  const s = [...xs].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mergeTwo(a: DealLike, b: DealLike): DealLike {
  // amounts seen so far (ranges are expanded back to their ends)
  const usdValues = [a.amountMinUsd, a.amountMaxUsd, a.amountUsd, b.amountMinUsd, b.amountMaxUsd, b.amountUsd].filter((x): x is number => x !== null);
  const distinct = Array.from(new Set(usdValues));
  let amountUsd: number | null = null;
  let amountInr: number | null = null;
  let min: number | null = null;
  let max: number | null = null;
  let disagree = false;
  if (distinct.length) {
    min = Math.min(...distinct);
    max = Math.max(...distinct);
    disagree = (max - min) / max > AMOUNT_TOLERANCE;
    amountUsd = disagree ? median(distinct) : (a.amountUsd ?? b.amountUsd);
    // INR keeps the same ratio as USD in whichever record had both
    const ratio = [a, b].map((d) => (d.amountUsd && d.amountInr ? d.amountInr / d.amountUsd : null)).find((r) => r !== null) ?? null;
    amountInr = amountUsd !== null && ratio !== null ? amountUsd * ratio : (a.amountInr ?? b.amountInr);
    if (!disagree) {
      min = null;
      max = null;
    }
  }
  const texts = Array.from(new Set([a.amountText, b.amountText].filter((t): t is string => !!t && t.trim() !== "")));
  const amountText = texts.length ? texts.join(" / ") : null;

  const investors = new Map<string, { name: string; role: "lead" | "participant" }>();
  for (const i of [...a.investors, ...b.investors]) {
    const k = normalizeName(i.name);
    const prev = investors.get(k);
    if (!prev || (i.role === "lead" && prev.role !== "lead")) investors.set(k, { name: prev?.name ?? i.name, role: i.role === "lead" ? "lead" : prev?.role ?? "participant" });
  }
  const founders = new Map<string, { name: string; role?: string | null }>();
  for (const f of [...a.founders, ...b.founders]) {
    const k = f.name.trim().toLowerCase();
    if (!founders.has(k)) founders.set(k, f);
  }
  const articleIds = Array.from(new Set([...a.articleIds, ...b.articleIds]));
  const sector = a.sector !== "Other" ? a.sector : b.sector;
  const summary = [a.summary, b.summary].filter((s): s is string => !!s).sort((x, y) => y.length - x.length)[0] ?? null;
  let confidence: Confidence;
  if (disagree) confidence = "low";
  else if (articleIds.length >= 2) confidence = "high";
  else confidence = a.confidence === "low" || b.confidence === "low" ? "low" : "medium";

  return {
    companyName: a.companyName.length >= b.companyName.length ? a.companyName : b.companyName,
    domain: a.domain ?? b.domain,
    stage: a.stage !== "Unknown" ? a.stage : b.stage,
    sector,
    announcedOn: a.announcedOn <= b.announcedOn ? a.announcedOn : b.announcedOn,
    amountUsd,
    amountInr,
    amountMinUsd: min,
    amountMaxUsd: max,
    amountText,
    summary,
    founders: [...founders.values()],
    investors: [...investors.values()],
    articleIds,
    confidence,
  };
}

/** Merges a list of candidates into unique deals. Order of input does not matter. */
export function dedupeDeals(deals: DealLike[], windowDays = DEDUPE_WINDOW_DAYS): DealLike[] {
  const sorted = [...deals].sort((x, y) => x.announcedOn.localeCompare(y.announcedOn) || x.companyName.localeCompare(y.companyName));
  const out: DealLike[] = [];
  for (const d of sorted) {
    const i = out.findIndex((o) => sameRound(o, d, windowDays));
    if (i >= 0) out[i] = mergeTwo(out[i], d);
    else out.push(d);
  }
  return out;
}
