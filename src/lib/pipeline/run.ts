/**
 * The pipeline orchestrator. Steps run in order and each one is recorded in the runs table,
 * which is what the Refresh stepper reads. Every step is safe to repeat: articles, extractions and deals are
 * stored as they go, so a run that runs out of time simply carries on next time.
 */
import { getBlocks, listCompanies, listInvestors, saveBlock } from "@/lib/config/store";
import { geminiConfigured, geminiStats } from "@/lib/gemini";
import { SearchBudget } from "@/lib/search";
import { addDays, istDay } from "@/lib/time";
import { targetWeek } from "./target-week";
import { buildActions } from "@/lib/actions/build";
import { collect } from "./collect";
import { analyseDigest, ensureTemplateDigests, prepareDigest, storeDigest, type PreparedDigest } from "./digest";
import { extractPending, type ExtractResult } from "./extract";
import { processExtracted, rematchRecent } from "./process";
import { releaseLock, setState, StepLog, type RunKind } from "./runs";

export interface RunOptions {
  runId: string;
  kind: RunKind;
  /** Total time we allow ourselves, in ms (the platform limit is 300 s). */
  budgetMs?: number;
  /** Builds the Section 3 action items. Provided by the actions module. */
  buildActions?: (prep: PreparedDigest, deadline: number) => Promise<unknown>;
  /** Sends the digest email after it is stored (scheduled runs only). */
  afterStore?: (week: string, log: StepLog) => Promise<void>;
}

export interface RunSummary {
  week: string;
  partial: boolean;
  digestSource: string | null;
}

export async function runPipeline(opts: RunOptions): Promise<RunSummary> {
  const started = Date.now();
  const deadline = started + (opts.budgetMs ?? 270_000);
  const log = new StepLog(opts.runId, opts.kind);
  const week = targetWeek();
  let partial = false;
  let digestSource: string | null = null;
  try {
    const blocks = await getBlocks();
    const [companies, investors] = await Promise.all([listCompanies(), listInvestors()]);
    const settings = blocks.digest_settings;
    const useAi = geminiConfigured();

    // 1. collect
    await log.step("collect", async () => {
      const budget = new SearchBudget(settings.max_search_queries_per_run);
      const r = await collect({
        since: new Date(Date.now() - settings.lookback_days * 86_400_000),
        until: new Date(),
        settings,
        sources: blocks.sources,
        chain: blocks.search_chain,
        mandate: blocks.mandate,
        onRadar: companies.filter((c) => c.tag === "On Radar"),
        investors,
        budget,
        deadline: started + 90_000,
        onFeedDiscovered: async (outlet, feedUrl) => {
          const current = (await getBlocks()).sources;
          await saveBlock("sources", { ...current, rss_and_sites: current.rss_and_sites.map((s) => (s.outlet === outlet ? { ...s, feed_url: feedUrl } : s)) });
        },
      });
      await setState("last_collect", { at: new Date().toISOString(), total: r.sourcesTotal, reachable: r.sourcesReachable, unreachable: r.unreachable, searchedInstead: r.searchedInstead, searchUnavailable: r.searchUnavailable });
      const providers = Object.entries(r.searchProviders).map(([k, v]) => `${k} ${v}`).join(", ") || "none used";
      return {
        message: `${r.sourcesReachable} of ${r.sourcesTotal} sources reachable. ${r.newArticles} new articles. Search: ${r.searchQueries} queries (${providers}), ${r.cacheHits} from cache.${r.searchErrors.length ? ` Search problems: ${[...new Set(r.searchErrors)].slice(0, 3).join("; ")}.` : ""}`,
        counts: { ...r },
      };
    });

    // 2. extract (repeat until nothing is left or time is short)
    await log.step("extract", async () => {
      const total: ExtractResult = { attempted: 0, extracted: 0, dealsFound: 0, failed: 0, calls: 0, remaining: 0, stoppedEarly: false, lastError: null };
      if (!useAi) return { message: "Gemini key not set, extraction skipped.", status: "skipped" as const };
      for (let i = 0; i < 20; i++) {
        const r = await extractPending({ settings, taxonomy: blocks.taxonomy, deadline: deadline - 60_000 });
        total.attempted += r.attempted;
        total.extracted += r.extracted;
        total.dealsFound += r.dealsFound;
        total.failed += r.failed;
        total.calls += r.calls;
        total.remaining = r.remaining;
        total.lastError = r.lastError ?? total.lastError;
        if (r.stoppedEarly) total.stoppedEarly = true;
        if (r.stoppedEarly || r.attempted === 0 || r.remaining <= 0) break;
      }
      if (total.stoppedEarly || total.remaining > 0) partial = true;
      return {
        message: `${total.extracted} articles read, ${total.dealsFound} deals found in ${total.calls} Gemini calls${total.failed ? `, ${total.failed} failed` : ""}${total.lastError ? ` (${total.lastError.slice(0, 120)})` : ""}.${total.remaining > 0 ? " More articles are waiting; press Refresh again to continue." : ""}`,
        counts: { ...total, gemini: geminiStats() },
        status: total.remaining > 0 || total.stoppedEarly ? ("partial" as const) : ("ok" as const),
      };
    });

    // 3. process: normalise, deduplicate, match
    await log.step("process", async () => {
      const p = await processExtracted({ blocks, companies });
      const re = await rematchRecent({ blocks, companies, sinceDay: addDays(istDay(), -7 * (settings.backfill_weeks + 2)) });
      return {
        message: `${p.articlesProcessed} articles processed: ${p.inserted} new deals, ${p.merged} merged with existing, ${p.watchlistMatches} matched to Portfolio or On Radar (${p.needsReview} need review). Re-checked ${re.checked} recent deals, ${re.changed} changed.`,
        counts: { ...p, rematch: re },
      };
    });

    // 4. compute
    let prep: PreparedDigest | null = null;
    const c = await log.step("compute", async () => {
      prep = await prepareDigest(week, blocks);
      return { message: `Week of ${week}: ${prep.compute.kpis.deals} deals, ${prep.candidates.length} highlight candidates.`, counts: { ...prep.compute.kpis } };
    });
    if (!c.ok || !prep) throw new Error(c.error ?? "Could not compute the week");
    const ready: PreparedDigest = prep;

    // 5. analyse
    let analysis!: Awaited<ReturnType<typeof analyseDigest>>;
    await log.step("analyse", async () => {
      analysis = await analyseDigest(ready, useAi && Date.now() < deadline - 20_000);
      digestSource = analysis.analysis.source;
      return { message: analysis.analysis.source === "gemini" ? "Gemini wrote the analysis from the computed numbers." : (analysis.analysis.note ?? "Template analysis used."), counts: { source: analysis.analysis.source } };
    });

    // 6. store
    await log.step("store", async () => {
      const actions = await (opts.buildActions ?? buildActions)(ready, started + (opts.budgetMs ?? 270_000) - 25_000).catch(() => ({}));
      await storeDigest(ready, analysis.analysis, analysis.highlights, actions);
      const extra = await ensureTemplateDigests(blocks, { skipWeek: week });
      return { message: `Digest for the week of ${week} saved${extra ? `, plus ${extra} earlier week${extra === 1 ? "" : "s"}` : ""}.` };
    });

    // 7. send (scheduled runs only)
    if (opts.afterStore) await opts.afterStore(week, log);

    await setState("last_run", { at: new Date().toISOString(), runId: opts.runId, kind: opts.kind, week, partial });
    await log.step("done", async () => ({ message: partial ? "Finished, but some articles are still waiting. Press Refresh again to continue." : "All done." }));
  } catch (e) {
    const id = await log.begin("done", undefined);
    await log.end(id, "error", e instanceof Error ? e.message : "The run failed");
  } finally {
    await releaseLock(opts.runId);
  }
  return { week, partial, digestSource };
}
