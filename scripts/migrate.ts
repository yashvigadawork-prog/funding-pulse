import "./env";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is missing. Put it in .env.local first.");
    process.exit(1);
  }
  await migrate(drizzle(neon(url)), { migrationsFolder: "./drizzle" });
  console.log("Database tables are up to date.");
}

main().catch((e) => {
  console.error("Migration failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
