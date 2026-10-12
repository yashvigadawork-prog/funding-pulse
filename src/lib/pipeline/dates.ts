/** Working out which day a deal belongs to. Pure functions. */
import { addDays, istDay, isValidDay } from "@/lib/time";

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/**
 * Weekly roundups say which days they cover, for example "Oct 5 - Oct 10". Returns the last day
 * of that range as YYYY-MM-DD (year taken from the publish date), or null if the title has no range.
 */
export function roundupEndFromTitle(title: string, publishedAt: Date | null): string | null {
  const t = title.toLowerCase();
  const re = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\s*(?:-|–|—|to)\s*(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(\d{1,2})/i;
  const m = t.match(re);
  if (!m) return null;
  const startMonth = MONTHS[m[1].slice(0, 3)];
  const endMonth = m[3] ? MONTHS[m[3].slice(0, 3)] : startMonth;
  const endDay = parseInt(m[4], 10);
  const ref = publishedAt ?? new Date();
  let year = ref.getUTCFullYear();
  // a "Dec 28 - Jan 3" roundup published in early January belongs to the previous year's December start
  const candidate = (y: number) => `${y}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  let end = candidate(year);
  if (!isValidDay(end)) return null;
  if (end > istDay(new Date(ref.getTime() + 7 * 86_400_000))) end = candidate(--year);
  return isValidDay(end) ? end : null;
}

/**
 * Picks the day to file a deal under. A date stated in the text wins when it is believable
 * (not in the future, not more than 45 days before publication). Otherwise the publication
 * day is used, except for roundups published early in the week, which cover the week before.
 */
export function chooseDealDate(p: {
  statedOn: string | null | undefined;
  publishedAt: Date | null;
  title: string;
  kind: string;
  today?: Date;
}): string {
  const today = istDay(p.today ?? new Date());
  const published = p.publishedAt ? istDay(p.publishedAt) : today;
  if (isValidDay(p.statedOn) && p.statedOn <= addDays(published, 1) && p.statedOn >= addDays(published, -45)) return p.statedOn;
  if (p.kind === "roundup") {
    const end = roundupEndFromTitle(p.title, p.publishedAt);
    if (end) return end;
    const dow = (new Date(`${published}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    if (dow <= 1) return addDays(published, -(dow + 1)); // Monday or Tuesday: it covers the week before
  }
  return published > today ? today : published;
}
