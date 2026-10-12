import "./env";

/** One-off history load: finds weekly roundups, reads them with Gemini, builds the trend baseline. */
async function main() {
  if (!process.env.DATABASE_URL || !process.env.GEMINI_API_KEY) {
    console.error("DATABASE_URL and GEMINI_API_KEY must both be set in .env.local first.");
    process.exit(1);
  }
  const { runBackfill } = await import("../src/lib/pipeline/backfill-run");
  await runBackfill({ budgetMs: 45 * 60_000, print: (m) => console.log(m) });
}

main().catch((e) => {
  console.error("Backfill failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
