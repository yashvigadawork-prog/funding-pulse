import "./env";

/** Runs one full refresh from the command line (same steps as the Refresh now button). */
async function main() {
  const { runPipeline } = await import("../src/lib/pipeline/run");
  const { acquireLock, newRunId, runRows, releaseLock } = await import("../src/lib/pipeline/runs");
  const runId = newRunId();
  if (!(await acquireLock(runId))) {
    console.log("Another run is active. Try again in a few minutes.");
    return;
  }
  const started = Date.now();
  const s = await runPipeline({ runId, kind: "refresh", budgetMs: Number(process.env.BUDGET_MS ?? 280000) });
  console.log(`Finished week ${s.week} in ${Math.round((Date.now() - started) / 1000)} s${s.partial ? " (some articles still waiting)" : ""}.`);
  for (const r of await runRows(runId)) console.log(`- ${r.step} [${r.status}] ${r.message ?? ""}`);
  await releaseLock(runId);
}
main().catch((e) => {
  console.error("Run failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
