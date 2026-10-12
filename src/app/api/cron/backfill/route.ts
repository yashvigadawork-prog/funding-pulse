import { after } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { handle } from "@/lib/api";
import { runBackfill } from "@/lib/pipeline/backfill-run";
import { acquireLock, activeRun, newRunId, releaseLock } from "@/lib/pipeline/runs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** One-off history load. Protected the same way as the digest endpoint. It can be called again to continue. */
async function run(req: Request) {
  if (!verifyCronSecret(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const busy = await activeRun();
  if (busy) return Response.json({ ok: true, status: "busy", runId: busy.runId });
  const runId = newRunId();
  if (!(await acquireLock(runId))) return Response.json({ ok: true, status: "busy" });
  after(async () => {
    try {
      await runBackfill({ budgetMs: 270_000, runId });
    } finally {
      await releaseLock(runId);
    }
  });
  return Response.json({ ok: true, status: "started", runId });
}

export const GET = handle(run);
export const POST = handle(run);
