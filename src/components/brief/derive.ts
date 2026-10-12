import { formatUsd } from "@/lib/money";
import type { DigestView } from "@/lib/view-types";

export function firstSentence(text: string, max = 110): string {
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/^.*?[.!?](?=\s|$)/);
  const s = m ? m[0] : t;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** The week in one sentence. The AI's own line when it exists, otherwise a sentence built from the computed numbers. */
export function weekHeadline(view: DigestView): string {
  const d = view.digest!;
  if (d.analysis.weekLine) return d.analysis.weekLine;
  const k = d.kpis;
  const c = d.patterns.computed;
  if (!k.deals) return "No funding deals were recorded this week.";
  const top = c.capital.find((x) => x.sector === k.topSector);
  if (k.topSector && k.topSectorUsd) return `${k.topSector} drew the most money this week: ${formatUsd(k.topSectorUsd)} across ${top?.deals ?? 0} ${top?.deals === 1 ? "deal" : "deals"}.`;
  return `${k.deals} funding ${k.deals === 1 ? "round was" : "rounds were"} announced this week.`;
}

export function weekBullets(view: DigestView): string[] {
  const a = view.digest!.analysis;
  if (a.weekBullets?.length) return a.weekBullets.map((b) => b.text).slice(0, 3);
  return [a.capital, a.momentum, a.new_investors].map((b) => b.headline ?? firstSentence(b.summary));
}
