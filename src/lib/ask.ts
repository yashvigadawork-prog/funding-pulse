import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { articles, dealInvestors, dealSources, deals, digests, investors } from "@/db/schema";
import { getBlocks, getSettings } from "@/lib/config/store";
import { escapeForTag, geminiConfigured, geminiJson, UNTRUSTED_NOTICE } from "@/lib/gemini";
import { numbersAreGrounded } from "@/lib/pipeline/analyse";
import type { Analysis } from "@/lib/pipeline/analyse";
import { search, SearchBudget } from "@/lib/search";
import { rankByQuestion, type AskDeal } from "./ask-rank";

export interface AskAnswer {
  found: boolean;
  answer: string;
  sources: { url: string; outlet: string | null }[];
  mode: "ai" | "keyword";
  note?: string;
}

const aiAnswer = z.object({ found: z.boolean(), answer: z.string().trim().max(1500), source_ids: z.array(z.coerce.number().int()).default([]) });

async function loadAskDeals(): Promise<AskDeal[]> {
  const rows = await db.select().from(deals).orderBy(desc(deals.announcedOn)).limit(600);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [inv, src] = await Promise.all([
    db.select({ dealId: dealInvestors.dealId, name: investors.name, role: dealInvestors.role }).from(dealInvestors).innerJoin(investors, eq(investors.id, dealInvestors.investorId)).where(inArray(dealInvestors.dealId, ids)),
    db.select({ dealId: dealSources.dealId, id: articles.id, url: articles.url, outlet: articles.outlet }).from(dealSources).innerJoin(articles, eq(articles.id, dealSources.articleId)).where(inArray(dealSources.dealId, ids)),
  ]);
  return rows.map((r) => ({
    id: r.id,
    company: r.companyName,
    sector: r.sector ?? "Other",
    stage: r.stage,
    amountText: r.amountText,
    date: r.announcedOn,
    tag: r.matchTag,
    summary: r.summary,
    investors: inv.filter((i) => i.dealId === r.id).map((i) => i.name),
    sources: src.filter((s) => s.dealId === r.id && !s.url.startsWith("paste:")).map((s) => ({ n: s.id, url: s.url, outlet: s.outlet })),
  }));
}

/** Answers only from stored data. Falls back to a plain keyword listing when the AI is unavailable. */
export async function askStored(question: string): Promise<AskAnswer> {
  const all = await loadAskDeals();
  const top = rankByQuestion(question, all, 20);
  if (!top.length) return { found: false, answer: "", sources: [], mode: "keyword" };
  const toSources = (ds: AskDeal[]) => ds.flatMap((d) => d.sources.map((s) => ({ url: s.url, outlet: s.outlet }))).filter((s, i, a) => a.findIndex((x) => x.url === s.url) === i);
  const keyword = (note: string): AskAnswer => ({
    found: true,
    mode: "keyword",
    note,
    answer: `Closest stored deals: ${top.slice(0, 6).map((d) => `${d.company} (${d.stage ?? "Unknown"}, ${d.amountText ?? "Undisclosed"}, ${d.date ?? "date not reported"})`).join("; ")}.`,
    sources: toSources(top.slice(0, 6)).slice(0, 8),
  });
  if (!geminiConfigured()) return keyword("The AI service is not available, so this is a plain keyword match of stored deals.");

  const latest = await db.select().from(digests).orderBy(desc(digests.weekStart)).limit(4);
  const notes = latest.map((d) => ({ week_start: d.weekStart, capital: (d.analysis as Analysis).capital.summary, momentum: (d.analysis as Analysis).momentum.summary, new_investors: (d.analysis as Analysis).new_investors.summary }));
  const data = { digest_notes: notes, deals: top.map((d) => ({ id: d.id, company: d.company, sector: d.sector, stage: d.stage, amount_as_reported: d.amountText ?? "Undisclosed", date: d.date, watchlist: d.tag, investors: d.investors, summary: d.summary, source_ids: d.sources.map((s) => s.n) })) };
  const dataJson = JSON.stringify(data);
  try {
    const a = await geminiJson({
      system: [
        "You answer questions for a venture scout using ONLY the stored data below.",
        UNTRUSTED_NOTICE,
        "If the stored data does not contain the answer, set found to false and leave answer empty. Never use outside knowledge, never guess, never calculate: copy numbers exactly as written.",
        "Cite source_ids from the deals you used. Keep the answer to a few short sentences.",
      ].join("\n"),
      prompt: `Stored data:\n${dataJson}\n\n<user_question>${escapeForTag(question)}</user_question>`,
      jsonSchema: { type: "object", properties: { found: { type: "boolean" }, answer: { type: "string" }, source_ids: { type: "array", items: { type: "integer" } } }, required: ["found", "answer", "source_ids"] },
      schema: aiAnswer,
      maxOutputTokens: 900,
    });
    if (!a.found || !a.answer) return { found: false, answer: "", sources: [], mode: "ai" };
    const allSources = new Map(top.flatMap((d) => d.sources).map((s) => [s.n, s]));
    const sources = a.source_ids.map((n) => allSources.get(n)).filter((s): s is NonNullable<typeof s> => !!s).map((s) => ({ url: s.url, outlet: s.outlet }));
    if (!numbersAreGrounded(a.answer, dataJson).ok || !sources.length) return keyword("The AI answer could not be checked against the data, so this is a plain keyword match of stored deals.");
    return { found: true, answer: a.answer, sources: sources.filter((s, i, arr) => arr.findIndex((x) => x.url === s.url) === i), mode: "ai" };
  } catch {
    return keyword("The AI service did not answer, so this is a plain keyword match of stored deals.");
  }
}

/** Clearly separate from stored data: a live web search summarised with links. */
export async function askWeb(question: string): Promise<{ answer: string; sources: { url: string; outlet: string | null }[]; provider: string | null; message?: string }> {
  const blocks = await getBlocks();
  const settings = await getSettings();
  const out = await search(question, { limit: 6 }, { chain: blocks.search_chain, settings, budget: new SearchBudget(2) });
  if (!out.results.length) return { answer: "", sources: [], provider: out.provider, message: "Live search is unavailable or found nothing right now." };
  const sources = out.results.slice(0, 5).map((r) => ({ url: r.url, outlet: r.title }));
  if (!geminiConfigured()) return { answer: "Top web results (not from stored data):", sources, provider: out.provider };
  const body = out.results.slice(0, 6).map((r, i) => `<source id="${i + 1}" url="${escapeForTag(r.url)}">${escapeForTag(`${r.title}\n${r.snippet}`)}</source>`).join("\n");
  try {
    const a = await geminiJson({
      system: `Summarise web search results for a venture scout. ${UNTRUSTED_NOTICE} Use only the results. If they do not answer the question, say so. Do not calculate. Keep it to three short sentences.`,
      prompt: `${body}\n\n<user_question>${escapeForTag(question)}</user_question>`,
      jsonSchema: { type: "object", properties: { answer: { type: "string" }, source_ids: { type: "array", items: { type: "integer" } } }, required: ["answer", "source_ids"] },
      schema: z.object({ answer: z.string().trim().max(1200), source_ids: z.array(z.coerce.number().int()).default([]) }),
      maxOutputTokens: 600,
    });
    const used = a.source_ids.map((n) => out.results[n - 1]).filter(Boolean).map((r) => ({ url: r.url, outlet: r.title }));
    return { answer: a.answer, sources: used.length ? used : sources, provider: out.provider };
  } catch {
    return { answer: "Top web results (not from stored data):", sources, provider: out.provider };
  }
}
