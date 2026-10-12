/**
 * One search() function in front of every provider. It tries them in the order set in the
 * search_chain config, skips providers whose keys are missing, moves on at the first error,
 * checks a 24-hour database cache first, and respects a per-run query cap.
 */
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { searchCache } from "@/db/schema";
import type { DigestSettings, SearchChain } from "@/lib/config/schema";
import { canonicalUrl, domainOf } from "@/lib/http";
import { PROVIDERS, type SearchOpts, type SearchResult } from "./providers";

export type { SearchOpts, SearchResult } from "./providers";

export class SearchBudget {
  used = 0;
  providerCounts: Record<string, number> = {};
  cacheHits = 0;
  constructor(public max: number) {}
  get exhausted() {
    return this.used >= this.max;
  }
}

export interface SearchOutcome {
  results: SearchResult[];
  provider: string | null;
  cached: boolean;
  errors: { provider: string; message: string }[];
  skippedForBudget?: boolean;
}

function keyFor(query: string, opts: SearchOpts) {
  return createHash("sha256")
    .update(JSON.stringify({ q: query.trim().toLowerCase(), l: opts.limit ?? 8, d: opts.days ?? 0, i: [...(opts.includeDomains ?? [])].sort() }))
    .digest("hex");
}

export function providerReady(entry: SearchChain[number]): boolean {
  return entry.env.every((k) => !!process.env[k]?.trim());
}

export async function search(
  query: string,
  opts: SearchOpts,
  ctx: { chain: SearchChain; settings: DigestSettings; budget?: SearchBudget },
): Promise<SearchOutcome> {
  const hash = keyFor(query, opts);
  const ttlMs = ctx.settings.search_cache_hours * 3_600_000;
  const [hit] = await db.select().from(searchCache).where(eq(searchCache.queryHash, hash)).limit(1);
  if (hit && Date.now() - hit.fetchedAt.getTime() < ttlMs) {
    if (ctx.budget) ctx.budget.cacheHits++;
    return { results: hit.results as SearchResult[], provider: hit.provider, cached: true, errors: [] };
  }
  if (ctx.budget?.exhausted) return { results: [], provider: null, cached: false, errors: [], skippedForBudget: true };

  const errors: SearchOutcome["errors"] = [];
  const chain = [...ctx.chain].sort((a, b) => a.order - b.order);
  for (const entry of chain) {
    const fn = PROVIDERS[entry.provider];
    if (!fn || !providerReady(entry)) continue;
    if (ctx.budget) {
      ctx.budget.used++;
      ctx.budget.providerCounts[entry.provider] = (ctx.budget.providerCounts[entry.provider] ?? 0) + 1;
    }
    try {
      let results = await fn(query, opts);
      results = results.filter((r) => /^https?:\/\//i.test(r.url)).map((r) => ({ ...r, url: canonicalUrl(r.url) }));
      if (opts.includeDomains?.length) {
        const want = opts.includeDomains.map((d) => d.toLowerCase());
        results = results.filter((r) => want.some((d) => domainOf(r.url) === d || domainOf(r.url).endsWith(`.${d}`)));
      }
      const seen = new Set<string>();
      results = results.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));
      await db
        .insert(searchCache)
        .values({ queryHash: hash, provider: entry.provider, results, fetchedAt: new Date() })
        .onConflictDoUpdate({ target: searchCache.queryHash, set: { provider: entry.provider, results, fetchedAt: new Date() } });
      return { results, provider: entry.provider, cached: false, errors };
    } catch (e) {
      errors.push({ provider: entry.provider, message: e instanceof Error ? e.message : "failed" });
      if (ctx.budget?.exhausted) break;
    }
  }
  return { results: [], provider: null, cached: false, errors };
}
