/**
 * Draft emails and LinkedIn notes. Plain templates filled only with facts we hold (nothing invented).
 * A missing value is left out of the sentence rather than guessed.
 */
import type { SenderProfile } from "@/lib/config/schema";
import type { Draft } from "./types";

export interface RoundFacts {
  company: string;
  founder: string | null;
  stage: string | null;
  amountText: string | null;
  sector: string | null;
  summary: string | null;
  sourceUrl: string | null;
}

const signature = (s: SenderProfile) => `${s.name}\n${[s.title, s.organisation].filter(Boolean).join(", ")}`;
const known = (v: string | null | undefined) => (v && v.toLowerCase() !== "unknown" && v.trim() ? v.trim() : null);

function roundPhrase(f: RoundFacts): string {
  const stage = known(f.stage);
  const amount = known(f.amountText) && !/undisclosed/i.test(f.amountText ?? "") ? f.amountText!.trim() : null;
  if (amount && stage) return `raised ${amount} in a ${stage} round`;
  if (amount) return `raised ${amount}`;
  if (stage) return `announced a ${stage} round`;
  return "announced new funding";
}

export function founderEmailDraft(f: RoundFacts, sender: SenderProfile): Draft {
  const greet = f.founder ? `Hi ${f.founder.split(/\s+/)[0]},` : `Hi ${f.company} team,`;
  const lines = [
    greet,
    "",
    sender.intro_line,
    "",
    `I came across the news that ${f.company} ${roundPhrase(f)}${f.sourceUrl ? ` (${f.sourceUrl})` : ""}.${known(f.summary) ? ` ${f.summary!.trim()}` : ""} Congratulations.`,
    "",
    `I would love to learn more about what you are building. Would you be open to a short call in the next couple of weeks?`,
    "",
    "Best,",
    signature(sender),
  ];
  return { subject: `Congratulations on the news, ${f.company}`, body: lines.join("\n") };
}

export function linkedinNoteDraft(f: RoundFacts, sender: SenderProfile): string {
  const greet = f.founder ? `Hi ${f.founder.split(/\s+/)[0]}` : "Hi";
  return `${greet}, saw the news about ${f.company}. I'm ${sender.name}, ${[sender.title, sender.organisation].filter(Boolean).join(" at ")}. Would love to learn more about what you're building.`.slice(0, 300);
}

export interface FollowUpFacts {
  kind: "named" | "adjacent" | "cluster";
  company: string;
  recipientName: string | null;
  named: { stage: string | null; amountText: string | null; sourceUrl: string | null }[];
  adjacent: { company: string; stage: string | null; amountText: string | null; sharedTerms: string[]; sourceUrl: string | null }[];
  windowDays: number;
}

export function portfolioFollowUpDraft(f: FollowUpFacts, sender: SenderProfile): Draft {
  const hi = f.recipientName ? `Hi ${f.recipientName.split(/\s+/)[0]},` : "Hi,";
  const lines: string[] = [hi, ""];
  if (f.kind === "named") {
    const n = f.named[0];
    lines.push(`${f.company} was in the news this week: it ${roundPhrase({ company: f.company, founder: null, stage: n?.stage ?? null, amountText: n?.amountText ?? null, sector: null, summary: null, sourceUrl: null })}.${n?.sourceUrl ? ` Source: ${n.sourceUrl}` : ""}`);
    lines.push("", "Worth a quick check-in to see how we can help.");
  } else {
    lines.push(
      f.kind === "cluster"
        ? `${f.adjacent.length === 1 ? "A company" : `${new Set(f.adjacent.map((a) => a.company)).size} companies`} in the same space as ${f.company} raised within ${f.windowDays} days:`
        : `A company in the same space as ${f.company} raised recently:`,
    );
    for (const a of f.adjacent) {
      const bits = [known(a.stage), known(a.amountText) && !/undisclosed/i.test(a.amountText ?? "") ? a.amountText : null].filter(Boolean).join(", ");
      lines.push(`- ${a.company}${bits ? ` (${bits})` : ""}${a.sharedTerms.length ? `, shares: ${a.sharedTerms.join(", ")}` : ""}${a.sourceUrl ? `. ${a.sourceUrl}` : ""}`);
    }
    lines.push("", `Might be useful context for ${f.company}. Happy to talk it through.`);
  }
  lines.push("", "Best,", signature(sender));
  return { subject: f.kind === "named" ? `${f.company} in the news` : `Activity near ${f.company}`, body: lines.join("\n") };
}

export interface LpFacts {
  fundName: string;
  weekLabel: string;
  deals: number;
  disclosedText: string;
  topSector: string | null;
  highlights: { company: string; stage: string | null; amountText: string | null; sourceUrl: string | null; why: string }[];
  adjacentLines: string[];
  reportUrl: string;
}

export function lpBriefDraft(f: LpFacts, sender: SenderProfile): Draft {
  const lines = [
    "Hi,",
    "",
    `Here is the Funding Pulse brief for ${f.weekLabel}.`,
    "",
    `${f.deals} deal${f.deals === 1 ? "" : "s"} tracked. Disclosed capital: ${f.disclosedText}.${f.topSector ? ` Most active sector: ${f.topSector}.` : ""}`,
    "",
    "Key points:",
    ...f.highlights.map((h) => `- ${h.company}${[known(h.stage), known(h.amountText) && !/undisclosed/i.test(h.amountText ?? "") ? h.amountText : null].filter(Boolean).length ? ` (${[known(h.stage), known(h.amountText) && !/undisclosed/i.test(h.amountText ?? "") ? h.amountText : null].filter(Boolean).join(", ")})` : ""}: ${h.why}${h.sourceUrl ? ` ${h.sourceUrl}` : ""}`),
    ...(f.adjacentLines.length ? ["", "Near our portfolio:", ...f.adjacentLines.map((l) => `- ${l}`)] : []),
    "",
    `Full report with sources: ${f.reportUrl}`,
    "",
    "Best,",
    signature(sender),
  ];
  return { subject: `${f.fundName}: funding brief for ${f.weekLabel}`, body: lines.join("\n") };
}
