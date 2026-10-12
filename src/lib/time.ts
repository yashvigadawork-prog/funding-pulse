/** Week boundaries are Monday to Sunday in Asia/Kolkata (UTC+5:30, no daylight saving). */
const IST_OFFSET_MIN = 330;
const DAY = 86_400_000;

function toIstParts(d: Date) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return shifted;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' for the IST calendar day of this instant. */
export function istDay(d: Date = new Date()): string {
  return isoDate(toIstParts(d));
}

/** Monday (IST) of the week containing this instant, as 'YYYY-MM-DD'. */
export function weekStartIST(d: Date = new Date()): string {
  const s = toIstParts(d);
  const dow = (s.getUTCDay() + 6) % 7; // Monday = 0
  return isoDate(new Date(s.getTime() - dow * DAY));
}

/** Monday of the week containing a 'YYYY-MM-DD' calendar day. */
export function weekStartOfDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return isoDate(new Date(d.getTime() - dow * DAY));
}

export function addDays(day: string, n: number): string {
  return isoDate(new Date(new Date(`${day}T00:00:00Z`).getTime() + n * DAY));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY);
}

export function weekEnd(weekStart: string): string {
  return addDays(weekStart, 6);
}

export function isValidDay(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
}

export function formatDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatWeekRange(weekStart: string): string {
  const s = new Date(`${weekStart}T00:00:00Z`);
  const e = new Date(`${weekEnd(weekStart)}T00:00:00Z`);
  const f = (d: Date, y: boolean) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(y ? { year: "numeric" } : {}), timeZone: "UTC" });
  return `${f(s, false)} – ${f(e, true)}`;
}

export function formatDateTimeIST(d: Date | string | null | undefined): string {
  if (!d) return "never";
  const date = typeof d === "string" ? new Date(d) : d;
  return (
    date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }) + " IST"
  );
}
