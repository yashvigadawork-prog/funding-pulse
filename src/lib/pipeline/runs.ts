/** Progress logging (the runs table), the one-run-at-a-time lock and the refresh cooldown. */
import { randomUUID } from "node:crypto";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { appState, locks, runs } from "@/db/schema";

export type RunKind = "refresh" | "weekly" | "backfill";
export type StepName = "start" | "collect" | "extract" | "process" | "compute" | "analyse" | "store" | "send" | "done" | "backfill";

export const LOCK_NAME = "pipeline";
const LOCK_MS = 6 * 60_000;

export function newRunId() {
  return `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
}

/** Takes the single pipeline lock. Returns false when another run is still active. */
export async function acquireLock(runId: string): Promise<boolean> {
  const until = new Date(Date.now() + LOCK_MS);
  const rows = await db
    .insert(locks)
    .values({ name: LOCK_NAME, runId, lockedUntil: until })
    .onConflictDoUpdate({
      target: locks.name,
      set: { runId, lockedUntil: until },
      setWhere: lt(locks.lockedUntil, new Date()),
    })
    .returning({ runId: locks.runId });
  return rows.length > 0 && rows[0].runId === runId;
}

export async function extendLock(runId: string) {
  await db
    .update(locks)
    .set({ lockedUntil: new Date(Date.now() + LOCK_MS) })
    .where(and(eq(locks.name, LOCK_NAME), eq(locks.runId, runId)));
}

export async function releaseLock(runId: string) {
  await db.update(locks).set({ lockedUntil: new Date(0) }).where(and(eq(locks.name, LOCK_NAME), eq(locks.runId, runId)));
}

export async function activeRun(): Promise<{ runId: string; lockedUntil: Date } | null> {
  const [row] = await db.select().from(locks).where(eq(locks.name, LOCK_NAME)).limit(1);
  if (row && row.lockedUntil.getTime() > Date.now() && row.runId) return { runId: row.runId, lockedUntil: row.lockedUntil };
  return null;
}

export class StepLog {
  constructor(
    public runId: string,
    public kind: RunKind,
  ) {}

  async begin(step: StepName, message?: string): Promise<number> {
    const [row] = await db
      .insert(runs)
      .values({ runId: this.runId, step, status: "running", kind: this.kind, message: message ?? null })
      .returning({ id: runs.id });
    await extendLock(this.runId);
    return row.id;
  }

  async end(id: number, status: "ok" | "error" | "skipped" | "partial", message: string, counts?: Record<string, unknown>) {
    await db.update(runs).set({ status, message, counts: counts ?? null, finishedAt: new Date() }).where(eq(runs.id, id));
  }

  /** Runs one step and records success or failure. Errors are returned, not thrown, so later steps can decide. */
  async step<T>(
    step: StepName,
    fn: () => Promise<{ message: string; counts?: Record<string, unknown>; status?: "ok" | "partial" | "skipped"; value?: T }>,
  ): Promise<{ ok: boolean; value?: T; error?: string }> {
    const id = await this.begin(step);
    try {
      const r = await fn();
      await this.end(id, r.status ?? "ok", r.message, r.counts);
      return { ok: true, value: r.value };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "failed";
      await this.end(id, "error", msg);
      return { ok: false, error: msg };
    }
  }
}

export async function runRows(runId: string) {
  return db.select().from(runs).where(eq(runs.runId, runId)).orderBy(runs.id);
}

export async function latestRun(): Promise<{ runId: string; kind: string; startedAt: Date } | null> {
  const [row] = await db.select({ runId: runs.runId, kind: runs.kind, startedAt: runs.startedAt }).from(runs).orderBy(desc(runs.id)).limit(1);
  return row ?? null;
}

/* ---- key/value state (cooldown timestamps, freshness) ---- */

export async function getState<T>(key: string): Promise<T | null> {
  const [row] = await db.select().from(appState).where(eq(appState.key, key)).limit(1);
  return (row?.value as T) ?? null;
}

export async function setState(key: string, value: unknown) {
  await db
    .insert(appState)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appState.key, set: { value, updatedAt: sql`now()` } });
}
