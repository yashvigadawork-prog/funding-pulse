/** Picks the stored deals that best match a question. Plain keyword scoring, no AI. */
export interface AskDeal {
  id: number;
  company: string;
  sector: string;
  stage: string | null;
  amountText: string | null;
  amountUsd?: number | null;
  amountInr?: number | null;
  date: string | null;
  tag: string | null;
  summary: string | null;
  investors: string[];
  sources: { n: number; url: string; outlet: string | null }[];
}

const STOP = new Set("the and for with what which who whom how did does has have had are was were any all this that those these from into about last week weeks month new raised raise raises funding deal deals startup startups company companies there their they them tell show give list".split(" "));

export function questionTerms(q: string): string[] {
  return Array.from(new Set(q.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t))));
}

export function rankByQuestion<T extends AskDeal>(question: string, deals: T[], limit: number): T[] {
  const terms = questionTerms(question);
  if (!terms.length) return [];
  const scored = deals
    .map((d) => {
      const name = d.company.toLowerCase();
      const hay = `${d.sector} ${d.stage ?? ""} ${d.tag ?? ""} ${d.summary ?? ""} ${d.investors.join(" ")}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (name.includes(t)) score += 5;
        if (d.investors.some((i) => i.toLowerCase().includes(t))) score += 4;
        if (hay.includes(t)) score += 1;
      }
      return { d, score };
    })
    .filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || (b.d.date ?? "").localeCompare(a.d.date ?? ""));
  return scored.slice(0, limit).map((x) => x.d);
}
