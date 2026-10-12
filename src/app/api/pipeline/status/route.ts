import { handle } from "@/lib/api";
import { getSettings } from "@/lib/config/store";
import { activeRun, getState, latestRun, runRows } from "@/lib/pipeline/runs";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const settings = await getSettings();
  const active = await activeRun();
  const latest = await latestRun();
  const runId = url.searchParams.get("run") ?? active?.runId ?? latest?.runId ?? null;
  const rows = runId ? await runRows(runId) : [];
  const last = await getState<{ at: string }>("last_refresh");
  const wait = last ? Number(settings.refresh_cooldown_minutes) * 60_000 - (Date.now() - new Date(last.at).getTime()) : 0;
  return Response.json({
    runId,
    running: !!active && active.runId === runId,
    steps: rows.map((r) => ({
      id: r.id,
      step: r.step,
      status: r.status,
      kind: r.kind,
      message: r.message,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
    })),
    cooldownSec: wait > 0 ? Math.ceil(wait / 1000) : 0,
    lastCollect: await getState("last_collect"),
    lastRun: await getState("last_run"),
  });
});
