/**
 * Draft emails and LinkedIn notes. Plain templates filled only with facts we hold (nothing invented).
 * A missing value is left out of the sentence rather than guessed.
 */
import type { SenderProfile } from "@/lib/config/schema";
import { amountSpoken, formatUsd } from "@/lib/money";
import type { SectorCapital, SectorTrend } from "@/lib/pipeline/compute";
import type { Draft } from "./types";

/**
 * Voice for every email: first person, written as the sender, warm and brief. No internal labels (Portfolio / On Radar),
 * no raw links in the body (the LP note ends with one "full brief" link) and every number comes from computed data.
 */

export interface RoundFacts {
  company: string;
  founder: string | null;
  stage: string | null;
  amountText: string | null;
  amountUsd?: number | null;
  amountInr?: number | null;
  sector: string | null;
  summary: string | null;
  sourceUrl: string | null;
  /** Where the news ran, for example "Entrackr". Named in words instead of pasting a link. */
  outlet?: string | null;
}

const known = (v: string | null | undefined) => (v && v.toLowerCase() !== "unknown" && v.trim() ? v.trim() : null);
export const firstName = (n: string | null | undefined) => (n && n.trim() ? n.trim().split(/\s+/)[0] : null);
const sentence = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

export const signature = (s: SenderProfile) => `Warm regards,\n${s.name}\n${[s.title, s.organisation].filter(Boolean).join(", ")}`;

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const numberWord = (n: number) => (Number.isInteger(n) && n >= 0 && n <= 10 ? NUMBER_WORDS[n] : String(n));
const SECTOR_WORDS: Record<string, string> = { "Health & wellness": "health", "Climate & sustainability": "climate", "Media, deeptech & education": "deeptech" };
export const sectorWord = (s: string | null | undefined) => (s ? (SECTOR_WORDS[s] ?? s.toLowerCase()) : "");
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "$2 million", "$1.5 million (about ₹12 crore)" from the computed amount; the reported text only when no number exists. */
function amountPhrase(f: { amountText: string | null; amountUsd?: number | null; amountInr?: number | null }): string | null {
  const spoken = amountSpoken({ amountUsd: f.amountUsd ?? null, amountInr: f.amountInr ?? null });
  if (spoken) return spoken;
  const t = known(f.amountText);
  return t && !/undisclosed|not disclosed|n\/a/i.test(t) && !/^\d*$/.test(t) ? t : null;
}

function roundPhrase(f: RoundFacts): string {
  const stage = known(f.stage);
  const amount = amountPhrase(f);
  if (amount && stage) return `raised ${amount} in a ${stage} round`;
  if (amount) return `raised ${amount}`;
  if (stage) return `announced a ${stage} round`;
  return "announced new funding";
}

export function founderEmailDraft(f: RoundFacts, sender: SenderProfile): Draft {
  const who = firstName(f.founder);
  const stage = known(f.stage);
  const amount = amountPhrase(f);
  const congrats = amount && stage ? `Congratulations on ${f.company}'s ${stage} round of ${amount}.` : amount ? `Congratulations on ${f.company} raising ${amount}.` : stage ? `Congratulations on ${f.company}'s ${stage} round.` : `Congratulations on the news from ${f.company}.`;
  const outlet = known(f.outlet);
  const lines = [
    who ? `Hi ${who},` : `Hi ${f.company} team,`,
    "",
    [
      congrats + (outlet ? ` I read about it in ${outlet}.` : ""),
      sender.intro_line.replace(/^I'm a venture scout/, `I'm ${sender.name}, a venture scout`),
      known(f.summary) ? `What caught my attention: ${sentence(f.summary!)}` : "",
      `${f.sector && known(f.sector) ? `${cap(sectorWord(f.sector))} is a space we follow closely, and ` : ""}${f.company} is the kind of early-stage Indian team we like to meet.`,
      "Would you be open to a 20-minute call in the next couple of weeks?",
    ]
      .filter(Boolean)
      .join(" "),
    "",
    signature(sender),
  ];
  return { subject: stage ? `Congratulations on ${f.company}'s ${stage} round` : `Congratulations, ${f.company}`, body: lines.join("\n") };
}

export function linkedinNoteDraft(f: RoundFacts, sender: SenderProfile): string {
  const greet = f.founder ? `Hi ${firstName(f.founder)}` : "Hi";
  return `${greet}, congratulations on the news about ${f.company}. I'm ${sender.name}, ${[sender.title, sender.organisation].filter(Boolean).join(" at ")}. Would love to learn more about what you're building.`.slice(0, 300);
}

export interface FollowUpFacts {
  kind: "named" | "adjacent" | "cluster";
  company: string;
  recipientName: string | null;
  named: { stage: string | null; amountText: string | null; amountUsd?: number | null; amountInr?: number | null; sourceUrl: string | null }[];
  adjacent: { company: string; stage: string | null; amountText: string | null; amountUsd?: number | null; amountInr?: number | null; sharedTerms: string[]; sourceUrl: string | null }[];
  windowDays: number;
}

const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export function portfolioFollowUpDraft(f: FollowUpFacts, sender: SenderProfile): Draft {
  const hi = firstName(f.recipientName) ? `Hi ${firstName(f.recipientName)},` : "Hi,";
  const lines: string[] = [hi, ""];
  if (f.kind === "named") {
    const n = f.named[0];
    const round = roundPhrase({ company: f.company, founder: null, stage: n?.stage ?? null, amountText: n?.amountText ?? null, amountUsd: n?.amountUsd, amountInr: n?.amountInr, sector: null, summary: null, sourceUrl: null });
    lines.push(`I saw the news that ${f.company} ${round}. Congratulations.`, "", "How are things going on your side, and is there anything we can help with, like an intro or a conversation?");
  } else {
    const names = [...new Set(f.adjacent.map((a) => a.company))];
    const bits = f.adjacent
      .map((a) => [known(a.stage), amountPhrase(a)].filter(Boolean).join(", "))
      .filter(Boolean);
    lines.push(
      names.length > 1
        ? `${cap(numberWord(names.length))} companies working close to ${f.company} raised within ${numberWord(f.windowDays)} days of each other: ${list(names)}.`
        : `${names[0]}, which works close to ${f.company}, raised recently${bits[0] ? ` (${bits[0]})` : ""}.`,
      "",
      `I thought you would want to know. How are you thinking about it, and would an intro or a conversation help?`,
    );
  }
  lines.push("", signature(sender));
  return { subject: f.kind === "named" ? `Congratulations, ${f.company}` : `Something close to ${f.company}`, body: lines.join("\n") };
}

export interface LpFacts {
  fundName: string;
  /** Start of the week as a short label, for example "5 Oct". */
  weekStartLabel: string;
  recipientName: string | null;
  deals: number;
  /** Up to three bullets, already worded from computed numbers (see lpBullets). */
  bullets: string[];
  /** The sectors that led on disclosed capital, used in the subject. */
  leadSectors: string[];
  /** The nearest portfolio cluster: how many companies, which sector, within how many days, next to which company. */
  nearby: { companies: number; sector: string; windowDays: number; portfolioName: string } | null;
  reportUrl: string;
}

const times = (r: number) => `roughly ${numberWord(Math.round(r))} times a usual week`;

/** The plain lines the LP note can use, each built only from computed figures. */
export function lpLines(capital: SectorCapital[], trends: SectorTrend[]): { lead?: string; second?: string; busy?: string; leadSectors: string[] } {
  const byCapital = capital.filter((c) => c.disclosedUsd > 0 && c.sector !== "Other").sort((a, b) => b.disclosedUsd - a.disclosedUsd);
  const out: { lead?: string; second?: string; busy?: string; leadSectors: string[] } = { leadSectors: byCapital.slice(0, 2).map((c) => sectorWord(c.sector)) };
  const lead = byCapital[0];
  if (lead) {
    const ratio = lead.baselineAvgUsd > 0 ? lead.disclosedUsd / lead.baselineAvgUsd : null;
    out.lead = `${cap(sectorWord(lead.sector))} led the week: ${formatUsd(lead.disclosedUsd)} disclosed across ${lead.deals} round${lead.deals === 1 ? "" : "s"}${ratio !== null && ratio >= 2 ? `, ${times(ratio)}` : ""}.`;
  }
  const second = byCapital[1];
  if (second) out.second = `${cap(sectorWord(second.sector))} followed with ${formatUsd(second.disclosedUsd)} across ${second.deals} round${second.deals === 1 ? "" : "s"}.`;
  const busy = trends.filter((t) => t.status === "accelerating" && t.sector !== "Other" && t.sector !== lead?.sector && t.sector !== second?.sector).sort((a, b) => b.extra - a.extra)[0];
  if (busy) {
    const usual = Math.round(busy.baselineAvg);
    out.busy = `${cap(sectorWord(busy.sector))} is busy again: ${busy.thisWeek} round${busy.thisWeek === 1 ? "" : "s"} against ${usual >= 1 ? `a usual ${usual}` : "almost none in a usual week"}.`;
  }
  return out;
}

/** At most three plain bullets, each built only from computed figures. */
export function lpBullets(capital: SectorCapital[], trends: SectorTrend[]): { bullets: string[]; leadSectors: string[] } {
  const l = lpLines(capital, trends);
  return { bullets: [l.lead, l.second, l.busy].filter((x): x is string => !!x).slice(0, 3), leadSectors: l.leadSectors };
}

/** The subject line: the week and what stood out. */
export function lpSubject(weekStartLabel: string, leadSectors: string[]): string {
  const headline = leadSectors.length >= 2 ? `${leadSectors[0]} and ${leadSectors[1]} pull in the big cheques` : leadSectors.length === 1 ? `${leadSectors[0]} leads the way` : "a quiet one";
  return `Week of ${weekStartLabel}: ${headline}`;
}

/** Spelled-out small numbers, for sentences like "within ten days". */
export { numberWord };

export function lpBriefDraft(f: LpFacts, sender: SenderProfile): Draft {
  const near = f.nearby;
  const nearLine = near
    ? `Closer to home, ${near.companies > 1 ? `${numberWord(near.companies)} ${sectorWord(near.sector)} companies raised within ${numberWord(near.windowDays)} days of each other` : `a ${sectorWord(near.sector)} company raised recently`}, right next to ${near.portfolioName}. I'll check in with the team this week and share what I hear.`
    : "";
  const parts = [
    f.recipientName ? `Hi ${firstName(f.recipientName)},` : "Hi,",
    "A quick read on last week, before your Monday gets busy.",
    f.bullets.length ? `${f.bullets.length === 3 ? "Three things" : f.bullets.length === 2 ? "Two things" : "One thing"} stood out:\n${f.bullets.map((b) => `• ${b}`).join("\n")}` : `It was a quiet week: ${f.deals} round${f.deals === 1 ? "" : "s"} tracked, nothing that changes the picture.`,
    nearLine,
    `The full brief, with every source, is here: ${f.reportUrl}`,
    "Happy to walk you through any of it on a call.",
    signature(sender),
  ].filter(Boolean);
  return { subject: lpSubject(f.weekStartLabel, f.leadSectors), body: parts.join("\n\n") };
}
