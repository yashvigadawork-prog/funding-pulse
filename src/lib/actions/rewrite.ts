/**
 * Helpers for "Rewrite warmer / Shorter / Improve". The AI only rewrites the middle of a message: the greeting line and the
 * sign-off are kept exactly as they were, so the layout can never be flattened. Pure functions, covered by tests.
 */

const SIGN_OFF = /\n\n(?=(?:Warm regards|Kind regards|Best regards|Regards|Best|Thanks|Cheers|Warmly)[,\n])/i;

export interface DraftParts {
  greeting: string;
  middle: string;
  signoff: string;
}

/** Greeting = the first line when it starts with Hi/Hello/Dear; sign-off = the closing block from "Warm regards," onward. */
export function splitDraft(body: string): DraftParts {
  let rest = body.trim();
  let greeting = "";
  const first = rest.match(/^((?:Hi|Hello|Dear)\b[^\n]*)(?:\n+|$)/i);
  if (first) {
    greeting = first[1].trim();
    rest = rest.slice(first[0].length);
  }
  let signoff = "";
  const at = rest.search(SIGN_OFF);
  if (at >= 0) {
    signoff = rest.slice(at).trim();
    rest = rest.slice(0, at);
  }
  return { greeting, middle: rest.trim(), signoff };
}

export function joinDraft(p: DraftParts): string {
  return [p.greeting, p.middle, p.signoff].filter((x) => x.trim()).join("\n\n");
}

const tokens = (t: string) => t.toLowerCase().replace(/[^a-z0-9₹$.\s]/g, " ").split(/\s+/).filter(Boolean);

/** 0 to 1: how much of the wording is shared (word overlap). 1 means the same words. */
export function similarity(a: string, b: string): number {
  const x = new Set(tokens(a));
  const y = new Set(tokens(b));
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const t of x) if (y.has(t)) both++;
  return both / Math.max(x.size, y.size);
}

export type RewriteMode = "improve" | "warmer" | "shorter";

/** Returns a reason when a rewrite is not different enough (or not short enough) to be worth showing, otherwise null. */
export function notEnoughChange(mode: RewriteMode, before: string, after: string): string | null {
  const sim = similarity(before, after);
  if (mode === "warmer" && sim > 0.8) return "the wording is almost the same as before";
  if (mode === "shorter" && after.length > before.length * 0.85) return "it is not noticeably shorter";
  if (mode === "improve" && after.trim() === before.trim()) return "nothing changed";
  return null;
}

export const bulletCount = (t: string) => (t.match(/^\s*[•\-*]\s/gm) ?? []).length;
