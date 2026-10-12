import "./env";
import { count, eq } from "drizzle-orm";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing. Put it in .env.local first.");
    process.exit(1);
  }
  const { db } = await import("../src/db");
  const { companies } = await import("../src/db/schema");
  const { seedIfMissing } = await import("../src/lib/config/store");
  const res = await seedIfMissing();
  const [p] = await db.select({ n: count() }).from(companies).where(eq(companies.tag, "Portfolio"));
  const [r] = await db.select({ n: count() }).from(companies).where(eq(companies.tag, "On Radar"));
  console.log(`Newly added this run: ${JSON.stringify(res.inserted)}`);
  console.log(`In the database now: ${p.n} Portfolio, ${r.n} On Radar companies.`);
}

main().catch((e) => {
  console.error("Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
