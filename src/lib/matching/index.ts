/**
 * Company matching. Pure functions only (no database, no network) so they are easy to test.
 *
 * Rules (from the brief):
 *  - compare case-insensitively on word boundaries, after lower-casing, stripping punctuation
 *    and dropping legal suffixes (Pvt, Private, Ltd, Limited ...)
 *  - names listed in `match_requires_context` (Jupiter, Even, Fold ...) only match when one of
 *    their context words appears near the name in the text
 *  - fuzzy matches at or above the review threshold, but not exact, are flagged for review
 */

export interface MatchCandidate {
  id: string;
  name: string;
  tag: "Portfolio" | "On Radar";
  aliases: string[];
  matchRequiresContext: string[];
}

export type MatchKind = "exact" | "alias" | "contains" | "fuzzy" | "none";

export interface MatchResult {
  company: MatchCandidate | null;
  kind: MatchKind;
  score: number;
  needsReview: boolean;
  reason: string;
  /** Set when a look-alike name was blocked because none of its context words appeared nearby. */
  rejectedForContext?: string;
}

const LEGAL_SUFFIXES = new Set(["pvt", "private", "ltd", "limited", "llp", "inc", "incorporated", "corp", "corporation", "llc"]);
const GENERIC_WORDS = new Set([
  "technologies",
  "technology",
  "tech",
  "labs",
  "lab",
  "india",
  "solutions",
  "systems",
  "services",
  "innovations",
  "software",
  "digital",
  "global",
]);

/** Lower-case, strip punctuation, drop legal suffixes. */
export function normalizeName(input: string): string {
  const cleaned = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return cleaned
    .split(/\s+/)
    .filter((t) => t && !LEGAL_SUFFIXES.has(t))
    .join(" ");
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word, case-insensitive regex for a term (may contain spaces). */
export function wordRegex(term: string, flags = "i"): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])${escapeRegex(term.trim()).replace(/\s+/g, "\\s+")}(?![A-Za-z0-9])`, flags);
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aM = new Array<boolean>(a.length).fill(false);
  const bM = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - range);
    const hi = Math.min(b.length - 1, i + range);
    for (let j = lo; j <= hi; j++) {
      if (!bM[j] && a[i] === b[j]) {
        aM[i] = bM[j] = true;
        matches++;
        break;
      }
    }
  }
  if (!matches) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aM[i]) continue;
    while (!bM[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

const CONTEXT_WINDOW = 160;
const SHORT_BLURB = 600;

/** True when one of the context words appears near the name in the text. */
export function hasContextNear(text: string | undefined, nameVariants: string[], contextWords: string[]): string | null {
  if (!text || !contextWords.length) return null;
  const lower = text.toLowerCase();
  const wordRes = contextWords.map((w) => ({ w, re: wordRegex(w) }));
  let foundName = false;
  for (const variant of nameVariants) {
    const re = wordRegex(variant, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower))) {
      foundName = true;
      const from = Math.max(0, m.index - CONTEXT_WINDOW);
      const to = Math.min(lower.length, m.index + m[0].length + CONTEXT_WINDOW);
      const windowText = lower.slice(from, to);
      for (const { w, re: wre } of wordRes) if (wre.test(windowText)) return w;
    }
  }
  // The name may not be repeated in a short blurb (for example a one-line summary): look at all of it.
  if (!foundName && lower.length <= SHORT_BLURB) {
    for (const { w, re } of wordRes) if (re.test(lower)) return w;
  }
  return null;
}

function tokens(s: string) {
  return s ? s.split(" ") : [];
}

/** Does `needle` appear as a run of whole tokens inside `hay`? Returns the leftover tokens. */
function containsTokens(hay: string[], needle: string[]): string[] | null {
  if (!needle.length || needle.length > hay.length) return null;
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((t, j) => hay[i + j] === t)) {
      return [...hay.slice(0, i), ...hay.slice(i + needle.length)];
    }
  }
  return null;
}

interface Scored {
  candidate: MatchCandidate;
  kind: Exclude<MatchKind, "none">;
  score: number;
  needsReview: boolean;
  variant: string;
  rank: number;
}

function scoreCandidate(dealNorm: string, c: MatchCandidate, fuzzyThreshold: number): Scored | null {
  const dealTokens = tokens(dealNorm);
  const variants: { text: string; alias: boolean; raw: string }[] = [
    { text: normalizeName(c.name), alias: false, raw: c.name },
    ...c.aliases.map((a) => ({ text: normalizeName(a), alias: true, raw: a })),
  ].filter((v) => v.text);
  let best: Scored | null = null;
  const take = (s: Scored) => {
    if (!best || s.rank > best.rank || (s.rank === best.rank && s.score > best.score)) best = s;
  };
  for (const v of variants) {
    if (v.text === dealNorm) {
      take({ candidate: c, kind: v.alias ? "alias" : "exact", score: 1, needsReview: false, variant: v.raw, rank: v.alias ? 3 : 4 });
      continue;
    }
    const vt = tokens(v.text);
    const left = containsTokens(dealTokens, vt);
    if (left) {
      const generic = left.every((t) => GENERIC_WORDS.has(t));
      take({ candidate: c, kind: "contains", score: generic ? 0.95 : 0.88, needsReview: !generic, variant: v.raw, rank: 2 });
      continue;
    }
    const rev = containsTokens(vt, dealTokens);
    if (rev && dealTokens.length >= 1 && dealNorm.length >= 4 && rev.every((t) => GENERIC_WORDS.has(t))) {
      take({ candidate: c, kind: "contains", score: 0.92, needsReview: true, variant: v.raw, rank: 2 });
      continue;
    }
    if (dealNorm.length >= 5 && v.text.length >= 5) {
      const jw = jaroWinkler(dealNorm, v.text);
      if (jw >= fuzzyThreshold) take({ candidate: c, kind: "fuzzy", score: jw, needsReview: true, variant: v.raw, rank: 1 });
    }
  }
  return best;
}

export function matchCompany(
  input: { name: string; context?: string },
  candidates: MatchCandidate[],
  opts: { fuzzyThreshold: number },
): MatchResult {
  const dealNorm = normalizeName(input.name);
  const none: MatchResult = { company: null, kind: "none", score: 0, needsReview: false, reason: "No match in Portfolio or On Radar" };
  if (!dealNorm) return none;

  let best: (Scored & { contextWord?: string }) | null = null;
  let rejectedForContext: string | null = null;
  for (const c of candidates) {
    const s = scoreCandidate(dealNorm, c, opts.fuzzyThreshold);
    if (!s) continue;
    let contextWord: string | undefined;
    if (c.matchRequiresContext.length) {
      const variants = [c.name, ...c.aliases, input.name];
      const found = hasContextNear(input.context, variants, c.matchRequiresContext);
      if (!found) {
        rejectedForContext = c.name;
        continue;
      }
      contextWord = found;
    }
    if (!best || s.rank > best.rank || (s.rank === best.rank && s.score > best.score)) best = { ...s, contextWord };
  }
  if (!best) {
    return rejectedForContext
      ? { ...none, rejectedForContext, reason: `Name resembles ${rejectedForContext}, but none of its context words appear nearby, so it was not matched` }
      : none;
  }
  const ctx = best.contextWord ? ` (context word "${best.contextWord}" found nearby)` : "";
  const what =
    best.kind === "exact"
      ? `Exact name match to ${best.candidate.name}`
      : best.kind === "alias"
        ? `Alias match: "${best.variant}" is an alias of ${best.candidate.name}`
        : best.kind === "contains"
          ? `Name contains "${best.variant}" (${best.candidate.name})`
          : `Fuzzy match to ${best.candidate.name} (similarity ${best.score.toFixed(2)})`;
  return {
    company: best.candidate,
    kind: best.kind,
    score: best.score,
    needsReview: best.needsReview,
    reason: `${what}${ctx}${best.needsReview ? ". Needs review" : ""}`,
  };
}

/** Which tracked companies are named in a block of text? Used for "portfolio in the news". */
export function findMentions(text: string, candidates: MatchCandidate[]): { company: MatchCandidate; reason: string }[] {
  const out: { company: MatchCandidate; reason: string }[] = [];
  for (const c of candidates) {
    const variants = [c.name, ...c.aliases].filter(Boolean);
    const hit = variants.find((v) => normalizeName(v).length >= 3 && wordRegex(v).test(text));
    if (!hit) continue;
    if (c.matchRequiresContext.length) {
      const w = hasContextNear(text, variants, c.matchRequiresContext);
      if (!w) continue;
      out.push({ company: c, reason: `Mentioned as "${hit}" with context word "${w}"` });
    } else {
      out.push({ company: c, reason: `Mentioned as "${hit}"` });
    }
  }
  return out;
}
