/**
 * "Adjacent to your portfolio": a deal that is not about a Portfolio company, but sits in the same
 * space as one. Deterministic code only: same sector plus enough shared meaningful words.
 */
import { normalizeName } from "@/lib/matching";
import { addDays } from "@/lib/time";

export interface AdjacencyDeal {
  id: number;
  companyName: string;
  matchTag: "Portfolio" | "On Radar" | null;
  sector: string;
  stage: string | null;
  amountText: string | null;
  amountUsd?: number | null;
  amountInr?: number | null;
  announcedOn: string;
  summary: string | null;
  sources: { url: string; outlet: string | null }[];
}

export interface AdjacencyPortfolio {
  id: string;
  name: string;
  sector: string;
  description: string | null;
}

export interface AdjacencySettings {
  adjacency_window_days: number;
  adjacency_min_shared_terms: number;
  adjacency_cluster_min_companies: number;
}

export interface AdjacentItem {
  dealId: number;
  companyName: string;
  matchTag: "Portfolio" | "On Radar" | null;
  stage: string | null;
  amountText: string | null;
  amountUsd: number | null;
  amountInr: number | null;
  announcedOn: string;
  sharedTerms: string[];
  sources: { url: string; outlet: string | null }[];
}

export interface AdjacentGroup {
  portfolioId: string;
  portfolioName: string;
  sector: string;
  items: AdjacentItem[];
  companies: number;
  cluster: boolean;
  windowDays: number;
  mostRecent: string;
}

const STOPWORDS = new Set(
  (
    "the and for with that this from are was were has have had its their they them you your our out all any can will into than then more most " +
    "also over such only both each other which what when where while who whom how about after before between during through under again further once " +
    "not but nor yet per via use used uses using new one two get gets got make makes made help helps helping enable enables enabling offer offers " +
    "startup startups platform company companies india indian technology tech based provides provide providing solutions solution services service app apps digital " +
    "raises raised raise raising funding round rounds led lead leads million crore seed series pre lakh billion " +
    "product products work working works business businesses customer customers user users market markets data tool tools system online service firm firms player players people team teams sector industry global"
  ).split(" "),
);
// Words in the sector's own name are too broad to mean anything.
const SECTOR_WORDS = new Set(["fintech", "health", "wellness", "climate", "sustainability", "sustainable", "media", "deeptech", "education"]);

function trimPlural(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) return w.slice(0, -1);
  return w;
}

/** Meaningful lower-case terms of a text. */
export function meaningfulTerms(text: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!text) return out;
  for (const raw of text.toLowerCase().normalize("NFKD").replace(/[^a-z\s]/g, " ").split(/\s+/)) {
    if (raw.length < 3) continue;
    const w = trimPlural(raw);
    if (w.length < 3 || STOPWORDS.has(raw) || STOPWORDS.has(w) || SECTOR_WORDS.has(raw) || SECTOR_WORDS.has(w)) continue;
    out.add(w);
  }
  return out;
}

export function sharedTerms(a: string | null | undefined, b: string | null | undefined): string[] {
  const tb = meaningfulTerms(b);
  return [...meaningfulTerms(a)].filter((t) => tb.has(t)).sort();
}

export function adjacencyWindow(weekStart: string, today: string, days: number): { from: string; to: string } {
  const weekEnd = addDays(weekStart, 6);
  const to = today >= weekStart && today < weekEnd ? today : weekEnd;
  return { from: addDays(to, -(days - 1)), to };
}

export function computeAdjacency(p: {
  deals: AdjacencyDeal[];
  portfolio: AdjacencyPortfolio[];
  weekStart: string;
  today: string;
  settings: AdjacencySettings;
}): AdjacentGroup[] {
  const { settings } = p;
  const win = adjacencyWindow(p.weekStart, p.today, settings.adjacency_window_days);
  // A Portfolio company named in a deal is a Direct hit, handled elsewhere.
  const candidates = p.deals.filter((d) => d.matchTag !== "Portfolio" && d.announcedOn >= win.from && d.announcedOn <= win.to);
  const groups: AdjacentGroup[] = [];
  for (const co of p.portfolio) {
    const items: AdjacentItem[] = [];
    for (const d of candidates) {
      if (d.sector !== co.sector) continue;
      const shared = sharedTerms(d.summary, co.description);
      if (shared.length < settings.adjacency_min_shared_terms) continue;
      items.push({
        dealId: d.id,
        companyName: d.companyName,
        matchTag: d.matchTag,
        stage: d.stage,
        amountText: d.amountText,
        amountUsd: d.amountUsd ?? null,
        amountInr: d.amountInr ?? null,
        announcedOn: d.announcedOn,
        sharedTerms: shared,
        sources: d.sources,
      });
    }
    if (!items.length) continue;
    items.sort((a, b) => b.announcedOn.localeCompare(a.announcedOn) || a.companyName.localeCompare(b.companyName));
    const companies = new Set(items.map((i) => normalizeName(i.companyName))).size;
    groups.push({
      portfolioId: co.id,
      portfolioName: co.name,
      sector: co.sector,
      items,
      companies,
      cluster: companies >= settings.adjacency_cluster_min_companies,
      windowDays: settings.adjacency_window_days,
      mostRecent: items[0].announcedOn,
    });
  }
  groups.sort((a, b) => Number(b.cluster) - Number(a.cluster) || b.items.length - a.items.length || b.mostRecent.localeCompare(a.mostRecent) || a.portfolioName.localeCompare(b.portfolioName));
  return groups;
}

/** The text on a card: why it is adjacent. */
export function describeGroup(g: AdjacentGroup): string {
  const terms = [...new Set(g.items.flatMap((i) => i.sharedTerms))].slice(0, 5).join(", ");
  const base = `Near ${g.portfolioName}: shares ${terms}`;
  return g.cluster ? `${base}. ${g.companies} companies in the same space raised within ${g.windowDays} days.` : `${base}.`;
}
