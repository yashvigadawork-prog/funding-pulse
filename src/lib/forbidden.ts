/**
 * Names that must never be shown anywhere in the app. This is the one list: `npm run check:names` reads it too.
 * The words are built from fragments so this file does not contain them. The stored source text is never changed;
 * these helpers only decide what is displayed, emailed, drafted or sent to Gemini.
 */
const FRAGMENTS: string[][] = [
  ["rain", "matter"],
  ["zero", "dha"],
];

export const FORBIDDEN_WORDS: string[] = FRAGMENTS.map((f) => f.join(""));
const alt = FORBIDDEN_WORDS.join("|");

/** Matches either name anywhere, in any case. */
export const FORBIDDEN_RE = new RegExp(alt, "i");
const FORBIDDEN_ALL = new RegExp(alt, "gi");
// "<first> by <second>" is one phrase.
const PHRASE = new RegExp(`${FORBIDDEN_WORDS[0]}\\s+by\\s+${FORBIDDEN_WORDS[1]}`, "gi");

export const REPLACEMENT = "another investor";

export function containsForbidden(s: string | null | undefined): boolean {
  return !!s && FORBIDDEN_RE.test(s);
}

/** An investor list with any forbidden name removed. */
export function visibleInvestors<T extends { name: string }>(list: T[]): T[] {
  return list.filter((i) => !containsForbidden(i.name));
}

export function visibleNames(list: string[]): string[] {
  return list.filter((n) => !containsForbidden(n));
}

/** Free text with any forbidden name replaced. */
export function scrubText(s: string): string {
  if (!containsForbidden(s)) return s;
  return s.replace(PHRASE, REPLACEMENT).replace(FORBIDDEN_ALL, REPLACEMENT);
}

/** Scrubs every string inside JSON-like data. */
export function scrubDeep<T>(v: T): T {
  if (typeof v === "string") return scrubText(v) as unknown as T;
  if (Array.isArray(v)) return v.map((x) => scrubDeep(x)) as unknown as T;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = scrubDeep(val);
    return out as T;
  }
  return v;
}
