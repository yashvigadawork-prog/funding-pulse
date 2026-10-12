import { weekStartIST } from "@/lib/time";

/** The week the digest describes: the one that just ended on Monday morning, otherwise the week so far. */
export function targetWeek(now = new Date()): string {
  return weekStartIST(new Date(now.getTime() - 86_400_000));
}
