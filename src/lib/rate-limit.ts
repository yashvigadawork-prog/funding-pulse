import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

/** Serverless has no shared memory, so counters live in the database. */
export async function hit(
  key: string,
  windowMs: number,
  limit: number,
): Promise<{ allowed: boolean; count: number; limit: number; retryAfterSec: number }> {
  const now = Date.now();
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  if (Math.random() < 0.02) {
    // housekeeping: forget counters older than two days
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now - 2 * 86_400_000)));
  }
  return {
    allowed: row.count <= limit,
    count: row.count,
    limit,
    retryAfterSec: Math.max(1, Math.ceil((windowStartMs + windowMs - now) / 1000)),
  };
}

/** Anonymised caller id: we store a short hash, never the raw address. */
export function clientId(req: Request): string {
  const xf = req.headers.get("x-forwarded-for") ?? "";
  const ip = xf.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`fp:${ip}`).digest("hex").slice(0, 16);
}

export const HOUR = 3_600_000;
export const DAY = 86_400_000;
