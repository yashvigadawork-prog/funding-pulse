/** Runs the backfill as a logged pipeline run (used by the script and the protected endpoint). */
import { getBlocks, listCompanies } from "@/lib/config/store";
import { geminiConfigured } from "@/lib/gemini";
import { acquireLock, newRunId, releaseLock, StepLog } from "./runs";
import { backfillRoundups } from "./backfill";
import { ensureTemplateDigests } from "./digest";
import { extractPending } from "./extract";
import { processExtracted, rematchRecent } from "./process";
import { addDays, istDay } from "@/lib/time";

export async function runBackfill(p: { budgetMs: number; print?: (m: string) => void; runId?: string }): Promise<{ ok: boolean; message: string }> {
  const say = p.print ?? (() => undefined);
  const runId = p.runId ?? newRunId();
  if (!p.runId && !(await acquireLock(runId))) {
    say("Another run is active. Try again in a few minutes.");
    return { ok: false, message: "Another run is active" };
  }
  const log = new StepLog(runId, "backfill");
  const started = Date.now();
  const deadline = started + p.budgetMs;
  try {
    const blocks = await getBlocks();
    const companies = await listCompanies();
    await log.step("backfill", async () => {
      const r = await backfillRoundups({ blocks, deadline: started + Math.min(p.budgetMs * 0.4, 8 * 60_000) });
      say(`Roundups found: ${r.roundupsFound}, saved: ${r.saved}, already stored: ${r.alreadyHad}. Weeks with none: ${r.weeksWithoutRoundup.join(", ") || "none"}.`);
      for (const n of r.notes) say(`Note: ${n}`);
      return { message: `${r.roundupsFound} roundups found, ${r.saved} new. Weeks without a roundup: ${r.weeksWithoutRoundup.length}.`, counts: { ...r } };
    });
    if (geminiConfigured()) {
      await log.step("extract", async () => {
        let attempted = 0;
        let deals = 0;
        let remaining = 0;
        for (let i = 0; i < 40; i++) {
          const r = await extractPending({ settings: blocks.digest_settings, taxonomy: blocks.taxonomy, deadline });
          attempted += r.attempted;
          deals += r.dealsFound;
          remaining = r.remaining;
          say(`Read ${attempted} articles so far, ${deals} deals found${r.lastError ? ` (${r.lastError.slice(0, 100)})` : ""}.`);
          if (r.stoppedEarly || r.attempted === 0 || r.remaining <= 0) break;
        }
        return { message: `${attempted} articles read, ${deals} deals found.${remaining > 0 ? " Some are left; run again." : ""}`, status: remaining > 0 ? ("partial" as const) : ("ok" as const) };
      });
    }
    await log.step("process", async () => {
      const r = await processExtracted({ blocks, companies });
      const re = await rematchRecent({ blocks, companies, sinceDay: addDays(istDay(), -7 * (blocks.digest_settings.backfill_weeks + 2)) });
      say(`Deals stored: ${r.inserted} new, ${r.merged} merged. Re-checked ${re.checked} deals.`);
      return { message: `${r.inserted} new deals, ${r.merged} merged.`, counts: { ...r } };
    });
    await log.step("store", async () => {
      const n = await ensureTemplateDigests(blocks);
      say(`Built ${n} week summaries.`);
      return { message: `${n} weekly summaries built.` };
    });
    await log.step("done", async () => ({ message: "Backfill finished." }));
    return { ok: true, message: "Backfill finished" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    const id = await log.begin("done");
    await log.end(id, "error", msg);
    return { ok: false, message: msg };
  } finally {
    if (!p.runId) await releaseLock(runId);
  }
}
