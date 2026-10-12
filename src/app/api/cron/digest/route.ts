import { after } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { handle } from "@/lib/api";
import { buildScheduledHooks } from "@/lib/actions/scheduled";
import { runPipeline } from "@/lib/pipeline/run";
import { acquireLock, activeRun, newRunId, releaseLock } from "@/lib/pipeline/runs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Called by cron-job.org every Monday. Needs `Authorization: Bearer <CRON_SECRET>`. */
async function run(req: Request) {
  if (!verifyCronSecret(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const busy = await activeRun();
  if (busy) return Response.json({ ok: true, status: "busy", message: "A run is already in progress", runId: busy.runId }, { status: 200 });
  const runId = newRunId();
  if (!(await acquireLock(runId))) return Response.json({ ok: true, status: "busy" }, { status: 200 });
  after(async () => {
    try {
      await runPipeline({ runId, kind: "weekly", ...buildScheduledHooks() });
    } catch {
      await releaseLock(runId);
    }
  });
  return Response.json({ ok: true, status: "started", runId });
}

export const GET = handle(run);
export const POST = handle(run);
