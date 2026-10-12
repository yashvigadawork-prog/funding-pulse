import { after } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { getSettings } from "@/lib/config/store";
import { runPipeline } from "@/lib/pipeline/run";
import { acquireLock, activeRun, getState, newRunId, releaseLock, setState } from "@/lib/pipeline/runs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Public "Refresh now". One run at a time, with a cooldown kept in the database. */
export const POST = handle(async () => {
  const settings = await getSettings();
  const busy = await activeRun();
  if (busy) throw new HttpError(409, "A refresh is already running. You can watch its progress above.", { runId: busy.runId });

  const last = await getState<{ at: string }>("last_refresh");
  if (last) {
    const wait = Number(settings.refresh_cooldown_minutes) * 60_000 - (Date.now() - new Date(last.at).getTime());
    if (wait > 0) {
      throw new HttpError(429, `Refresh is cooling down. Please try again in ${Math.ceil(wait / 60_000)} minute${Math.ceil(wait / 60_000) === 1 ? "" : "s"}.`, {
        retryAfterSec: Math.ceil(wait / 1000),
      });
    }
  }
  const runId = newRunId();
  if (!(await acquireLock(runId))) throw new HttpError(409, "A refresh is already running.");
  await setState("last_refresh", { at: new Date().toISOString(), runId });
  after(async () => {
    try {
      await runPipeline({ runId, kind: "refresh" });
    } catch {
      await releaseLock(runId);
    }
  });
  return Response.json({ ok: true, runId });
});
