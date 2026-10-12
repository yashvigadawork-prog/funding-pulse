import { buildActions } from "@/lib/actions/build";
import { sendDigestEmail } from "@/lib/email/digest-send";
import type { RunOptions } from "@/lib/pipeline/run";

/** Extra steps for the Monday run: build action items and email the digest (once). */
export function buildScheduledHooks(): Pick<RunOptions, "buildActions" | "afterStore"> {
  return { buildActions, afterStore: (week, log) => sendDigestEmail(week, log) };
}
