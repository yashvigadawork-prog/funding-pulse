/** The exact stage words an article uses near a company's name (for example "Series B"). Never guesses: null if none. */
export function statedStageWords(text: string, company: string): string | null {
  const name = company.trim();
  if (!name || !text) return null;
  const lower = text.toLowerCase();
  const needle = name.toLowerCase();
  const re = /pre-?series\s?a|pre-?seed|series\s?[a-z]\+?|seed(?: round| funding)?|bridge round|debt/i;
  let from = 0;
  while (from < lower.length) {
    const i = lower.indexOf(needle, from);
    if (i < 0) break;
    const m = text.slice(Math.max(0, i - 160), i + needle.length + 220).match(re);
    if (m) return m[0].replace(/\s+/g, " ").replace(/^series\s?([a-z])/i, (_, l) => `Series ${l.toUpperCase()}`);
    from = i + needle.length;
  }
  return null;
}
