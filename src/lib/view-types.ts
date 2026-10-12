/** Shapes shared by the API and the screens. Safe to import from client code (types only). */
import type { Analysis } from "@/lib/pipeline/analyse";
import type { AdjacentGroup } from "@/lib/pipeline/adjacency";
import type { ReviewItem, StoredHighlight } from "@/lib/pipeline/digest";
import type { WeekCompute } from "@/lib/pipeline/compute";
import type { ActionsBlock } from "@/lib/actions/types";

export interface DealRowView {
  id: number;
  companyName: string;
  companyId: string | null;
  domain: string | null;
  matchTag: "Portfolio" | "On Radar" | null;
  matchReason: string | null;
  needsReview: boolean;
  sector: string;
  stage: string | null;
  amountText: string | null;
  amountUsd: number | null;
  amountInr: number | null;
  amountMinUsd: number | null;
  amountMaxUsd: number | null;
  announcedOn: string | null;
  confidence: string;
  summary: string | null;
  founders: { name: string; role?: string | null }[];
  investors: { name: string; role: "lead" | "participant"; newInSector: boolean }[];
  sources: { url: string; outlet: string | null; title: string | null }[];
  adjacentTo: { portfolioName: string; sharedTerms: string[] }[];
}

export interface QualityView {
  sources: { total: number; reachable: number; unreachable: string[] } | null;
  articlesRead: number;
  dealsFound: number;
  undisclosed: number;
  needsReview: number;
  lastUpdatedAt: string | null;
  daysOld: number | null;
  typicalVolume: { min: number; max: number };
  searchUnavailable: boolean;
  partialRun: boolean;
}

export interface DigestView {
  weeks: { week: string; deals: number; source: string; emailedAt: string | null }[];
  week: string | null;
  digest: {
    kpis: Record<string, number | string | null> & {
      deals: number;
      disclosedUsd: number;
      disclosedInr: number;
      undisclosedCount: number;
      topSector: string | null;
      topSectorUsd: number | null;
      watchlistHits: number;
      newInvestors: number;
      directHits?: number;
      adjacentHits?: number;
      adjacentClusters?: number;
      prevDeals?: number;
      prevDisclosedUsd?: number;
    };
    highlights: StoredHighlight[];
    patterns: { computed: WeekCompute; adjacency?: AdjacentGroup[]; needsReview?: ReviewItem[]; items: { key: string; title: string; oneLine: string }[] };
    analysis: Analysis;
    actions: ActionsBlock | Record<string, never>;
    emailedAt: string | null;
    createdAt: string;
  } | null;
  deals: DealRowView[];
  quality: QualityView;
  fundName: string;
}
