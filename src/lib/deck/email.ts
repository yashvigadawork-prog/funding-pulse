/**
 * The tailored LP note. Every section the user ticks adds its own point,
 * and an attached summary deck replaces the old link. Pure code: every figure comes from the stored digest.
 */
import type { SenderProfile } from "@/lib/config/schema";
import { stageLabel } from "@/lib/format";
import { formatUsd } from "@/lib/money";
import { formatWeekStart } from "@/lib/time";
import type { Draft } from "@/lib/actions/types";
import { firstName, lpLines, lpSubject, numberWord, sectorWord, signature } from "@/lib/actions/drafts";
import type { DigestView } from "@/lib/view-types";
import type { DeckSectionId } from "./sections";

export interface LpEmailInput {
  view: DigestView;
  sections: readonly DeckSectionId[];
  /** True when the summary deck PDF will be attached. */
  attach: boolean;
  sender: SenderProfile;
  recipientName: string | null;
}

/** One plain sentence per section. Missing when there is nothing true to say. */
export function lpSectionLines(view: DigestView): Partial<Record<DeckSectionId | "money2", string>> {
  const d = view.digest;
  if (!d) return {};
  const c = d.patterns.computed;
  const k = d.kpis;
  const lines = lpLines(c.capital, c.trends);
  const out: Partial<Record<DeckSectionId | "money2", string>> = {};

  const prev = typeof k.prevDeals === "number" ? k.prevDeals : null;
  out.glance = `${k.deals} round${k.deals === 1 ? " was" : "s were"} announced${prev !== null ? `, against ${prev} the week before` : ""}${k.disclosedUsd > 0 ? `, with ${formatUsd(k.disclosedUsd)} disclosed` : ""}.`;
  out.money = lines.lead;
  out.money2 = lines.second;
  out.momentum = lines.busy;

  const fresh = new Set(c.newInvestors.map((n) => n.investor.toLowerCase()));
  const watched = new Set(c.newInvestors.filter((n) => n.onWatchlist).map((n) => n.investor.toLowerCase()));
  if (fresh.size) out.investors = `${fresh.size} investor${fresh.size === 1 ? " is" : "s are"} new to our records in the sectors we focus on${watched.size ? `, ${watched.size} of them ones we watch closely` : ""}.`;

  const top = [...d.highlights].sort((a, b) => a.rank - b.rank)[0];
  const focus = c.focusDealIds.length;
  if (top && focus) {
    const stage = top.stage && stageLabel(top.stage) !== "Stage not reported" ? stageLabel(top.stage) : null;
    const amount = top.amountUsd !== null ? formatUsd(top.amountUsd) : null;
    const detail = [stage, amount].filter(Boolean).join(", ");
    out.fit = `${focus} deal${focus === 1 ? " fits" : "s fit"} what we back, led by ${top.companyName}${detail ? ` (${detail})` : ""}.`;
  }

  const hits = view.deals.filter((x) => x.matchTag && !x.needsReview).sort((a, b) => (b.amountUsd ?? -1) - (a.amountUsd ?? -1));
  if (hits.length) {
    const named = hits.slice(0, 2).map((h) => h.companyName);
    out.names = `${hits.length} ${hits.length === 1 ? "company we back or follow was" : "companies we back or follow were"} in the news${named.length ? `, including ${named.join(" and ")}` : ""}.`;
  }

  const groups = d.patterns.adjacency ?? [];
  const near = groups.find((g) => g.cluster) ?? groups[0];
  if (near) {
    out.nearby = `Closer to home, ${near.companies > 1 ? `${numberWord(near.companies)} ${sectorWord(near.sector)} companies raised within ${numberWord(near.windowDays)} days of each other` : `a ${sectorWord(near.sector)} company raised recently`}, right next to ${near.portfolioName}. I'll check in with the team this week and share what I hear.`;
  }
  return out;
}

/** Builds the note. Same voice as before: first person, warm, brief, no internal labels. */
export function buildLpEmail(input: LpEmailInput): Draft {
  const { view, sections, attach, sender, recipientName } = input;
  const want = new Set(sections);
  const lines = lpSectionLines(view);
  const order: (DeckSectionId | "money2")[] = ["glance", "money", "money2", "momentum", "investors", "fit", "names"];
  const bullets = order
    .filter((id) => (id === "money2" ? want.has("money") : want.has(id)))
    .map((id) => lines[id])
    .filter((x): x is string => !!x);
  const nearby = want.has("nearby") ? lines.nearby : undefined;

  const count = bullets.length;
  const heading = count === 1 ? "One thing stood out" : `${numberWord(count).replace(/^./, (c) => c.toUpperCase())} things stood out`;
  const intro = count ? `${heading}:\n${bullets.map((b) => `• ${b}`).join("\n")}` : "";
  const attachLine = attach ? (count || nearby ? "I've attached a short deck with the detail behind each of these." : "I've attached a short deck with the detail from last week.") : "";
  const fallback = !count && !nearby && !attach ? "Here is a short summary of last week." : "";

  const { leadSectors } = lpLines(view.digest?.patterns.computed.capital ?? [], view.digest?.patterns.computed.trends ?? []);
  const parts = [
    recipientName ? `Hi ${firstName(recipientName)},` : "Hi,",
    "A quick read on last week, before your Monday gets busy.",
    intro,
    nearby ?? "",
    fallback,
    attachLine,
    "Happy to walk you through any of it on a call.",
    signature(sender),
  ].filter(Boolean);
  return { subject: lpSubject(view.week ? formatWeekStart(view.week) : "", leadSectors), body: parts.join("\n\n") };
}
