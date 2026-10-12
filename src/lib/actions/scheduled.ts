import type { RunOptions } from "@/lib/pipeline/run";

/** Hooks for the scheduled run (building action items, sending the digest). Filled in by the email phase. */
export function buildScheduledHooks(): Pick<RunOptions, "buildActions" | "afterStore"> {
  return {};
}
