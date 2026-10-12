/**
 * Extract: ask Gemini Flash to pull funding deals out of article text, several articles per call.
 * The answer is validated, then stored on the article row, so no work is ever repeated.
 */
import { and, asc, eq, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { articles, type Article } from "@/db/schema";
import { escapeForTag, geminiJson, UNTRUSTED_NOTICE, truncate } from "@/lib/gemini";
import type { DigestSettings, Taxonomy } from "@/lib/config/schema";

export const MAX_ATTEMPTS = 3;
const EXTRACT_CONCURRENCY = 3;
const MAX_CHARS_PER_CALL = 36_000;

const nullableStr = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => (v === undefined || v === null ? null : String(v).trim() || null))
  .catch(null);

const nullableNum = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  })
  .catch(null);

const strList = z
  .array(z.union([z.string(), z.null()]))
  .optional()
  .transform((v) => (v ?? []).filter((x): x is string => !!x && x.trim() !== "").map((x) => x.trim()))
  .catch([]);

const UNITS = ["thousand", "lakh", "million", "crore", "billion"] as const;

export const extractedDealSchema = z.object({
  company_name: z.string().trim().min(1),
  company_domain: nullableStr,
  stage: nullableStr,
  amount_text: nullableStr,
  amount_value: nullableNum,
  amount_unit: nullableStr.transform((u) => {
    const x = u?.toLowerCase().replace(/s$/, "") ?? null;
    if (!x) return null;
    if (x === "mn" || x === "m") return "million";
    if (x === "bn" || x === "b") return "billion";
    if (x === "cr") return "crore";
    return (UNITS as readonly string[]).includes(x) ? (x as (typeof UNITS)[number]) : null;
  }),
  currency: nullableStr.transform((c) => {
    const x = c?.toUpperCase() ?? null;
    return x === "USD" || x === "INR" ? x : null;
  }),
  sector: nullableStr,
  announced_on: nullableStr,
  summary: nullableStr,
  lead_investors: strList,
  other_investors: strList,
  founders: z
    .array(z.object({ name: z.string().trim().min(1), role: nullableStr }))
    .optional()
    .transform((v) => v ?? [])
    .catch([]),
});
export type ExtractedDeal = z.infer<typeof extractedDealSchema>;

const responseSchema = z.object({
  articles: z.array(
    z.object({
      article_id: z.coerce.number().int(),
      deals: z.array(z.unknown()).default([]),
    }),
  ),
});

const dealJsonSchema = {
  type: "object",
  properties: {
    company_name: { type: "string", description: "Name of the startup that raised money, exactly as written" },
    company_domain: { type: ["string", "null"], description: "Website domain only if stated in the text" },
    stage: { type: ["string", "null"], description: "Round stage as stated, for example Seed, Pre-Series A, Series B, Debt" },
    amount_text: { type: ["string", "null"], description: "The amount exactly as written in the text, for example $5 million or Rs 40 crore. null if not stated" },
    amount_value: { type: ["number", "null"], description: "The number in the amount as written, no conversion. null if not stated" },
    amount_unit: { type: ["string", "null"], description: "One of thousand, lakh, million, crore, billion as written. null if none" },
    currency: { type: ["string", "null"], description: "USD or INR as written. null if not stated" },
    sector: { type: ["string", "null"], description: "One sector from the allowed list, or null if unclear" },
    announced_on: { type: ["string", "null"], description: "YYYY-MM-DD only if the text states the date, else null" },
    summary: { type: ["string", "null"], description: "At most 30 words on what the company does and the round, using only the text" },
    lead_investors: { type: "array", items: { type: "string" }, description: "Investors the text says led the round" },
    other_investors: { type: "array", items: { type: "string" }, description: "Other named investors" },
    founders: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, role: { type: ["string", "null"] } }, required: ["name"] },
      description: "Founders only if named in the text",
    },
  },
  required: ["company_name"],
};

const jsonSchema = {
  type: "object",
  properties: {
    articles: {
      type: "array",
      items: {
        type: "object",
        properties: { article_id: { type: "integer" }, deals: { type: "array", items: dealJsonSchema } },
        required: ["article_id", "deals"],
      },
    },
  },
  required: ["articles"],
};

export function buildExtractionPrompt(batch: Pick<Article, "id" | "outlet" | "url" | "publishedAt" | "title" | "text">[], taxonomy: Taxonomy, maxChars: number) {
  const sectors = Object.keys(taxonomy.sectors).join(" | ");
  const stages = taxonomy.stages.filter((s) => s !== "Unknown").join(" | ");
  const system = [
    "You extract startup funding deals from news text for a venture scout in India.",
    UNTRUSTED_NOTICE,
    "Rules:",
    "- Use ONLY the text provided. Never use outside knowledge and never guess. If a value is not in the text, return null.",
    "- Include only funding rounds raised by startups (equity or debt) that the text reports. Skip acquisitions, IPOs, grants, layoffs, rumours and opinion pieces.",
    "- Include only startups based in or operating mainly in India. Skip established corporates and conglomerates unless the text itself calls the company a startup.",
    "- One entry per company per round per article. A roundup article may list many companies: return every one of them.",
    "- amount_text must be copied exactly from the text. amount_value, amount_unit and currency describe the same amount without converting or adding anything.",
    "- Do no arithmetic. Do not convert currencies. Do not total amounts.",
    `- sector must be one of: ${sectors}. Use null if you cannot tell from the text.`,
    `- stage should be one of: ${stages} (as stated in the text). Use null if not stated.`,
    "- Investor names exactly as written. Put investors described as leading the round in lead_investors.",
    "- Every article in the input must appear in the output once, with an empty deals list if it has no qualifying deal.",
  ].join("\n");
  const body = batch
    .map(
      (a) =>
        `<article id="${a.id}" outlet="${escapeForTag(a.outlet ?? "")}" published="${a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : "unknown"}" url="${escapeForTag(a.url)}">\nTitle: ${escapeForTag(a.title ?? "")}\n${escapeForTag(truncate(a.text ?? "", maxChars))}\n</article>`,
    )
    .join("\n\n");
  return { system, prompt: `Extract the funding deals from each article below.\n\n${body}` };
}

export interface ExtractResult {
  attempted: number;
  extracted: number;
  dealsFound: number;
  failed: number;
  calls: number;
  remaining: number;
  stoppedEarly: boolean;
  lastError: string | null;
}

/** Splits articles into batches: roundups travel alone, others are grouped up to the batch size. */
export function makeBatches<T extends { kind: string; text: string | null }>(items: T[], batchSize: number): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let chars = 0;
  const flush = () => {
    if (cur.length) out.push(cur);
    cur = [];
    chars = 0;
  };
  for (const a of items) {
    const len = Math.min(a.text?.length ?? 0, 12_000);
    if (a.kind === "roundup") {
      flush();
      out.push([a]);
      continue;
    }
    if (cur.length >= batchSize || chars + len > MAX_CHARS_PER_CALL) flush();
    cur.push(a);
    chars += len;
  }
  flush();
  return out;
}

export async function extractPending(p: { settings: DigestSettings; taxonomy: Taxonomy; deadline: number; limit?: number }): Promise<ExtractResult> {
  const rows = await db
    .select()
    .from(articles)
    .where(and(isNull(articles.extracted), eq(articles.processed, false), lt(articles.attempts, MAX_ATTEMPTS)))
    .orderBy(sql`case when ${articles.kind} = 'roundup' then 0 else 1 end`, asc(articles.id))
    .limit(p.limit ?? 120);
  const res: ExtractResult = { attempted: 0, extracted: 0, dealsFound: 0, failed: 0, calls: 0, remaining: rows.length, stoppedEarly: false, lastError: null };
  const batches = makeBatches(rows, p.settings.extraction_batch_size);
  let next = 0;
  let halt = false;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= batches.length || halt) return;
      const batch = batches[i];
      if (Date.now() > p.deadline) {
        res.stoppedEarly = true;
        halt = true;
        return;
      }
      await runBatch(batch);
    }
  };
  async function runBatch(batch: typeof rows) {
    res.calls++;
    res.attempted += batch.length;
    const { system, prompt } = buildExtractionPrompt(batch, p.taxonomy, p.settings.max_article_chars * (batch[0].kind === "roundup" ? 4 : 1));
    const isRoundup = batch[0].kind === "roundup";
    try {
      const out = await geminiJson({ system, prompt, jsonSchema, schema: responseSchema, maxOutputTokens: isRoundup ? 16_000 : 8_000 });
      const byId = new Map(out.articles.map((a) => [a.article_id, a.deals]));
      for (const a of batch) {
        const rawDeals = byId.get(a.id);
        if (rawDeals === undefined) {
          // Gemini skipped it: count an attempt and try again next time.
          await db.update(articles).set({ attempts: sql`${articles.attempts} + 1` }).where(eq(articles.id, a.id));
          res.failed++;
          continue;
        }
        const deals: ExtractedDeal[] = [];
        for (const d of rawDeals) {
          const r = extractedDealSchema.safeParse(d);
          if (r.success) deals.push(r.data);
        }
        await db.update(articles).set({ extracted: deals, attempts: sql`${articles.attempts} + 1` }).where(eq(articles.id, a.id));
        res.extracted++;
        res.dealsFound += deals.length;
        res.remaining--;
      }
    } catch (e) {
      res.lastError = e instanceof Error ? e.message : "Gemini failed";
      for (const a of batch) await db.update(articles).set({ attempts: sql`${articles.attempts} + 1` }).where(eq(articles.id, a.id));
      res.failed += batch.length;
      // A quota problem will not fix itself within this run.
      if (/quota|RESOURCE_EXHAUSTED|GEMINI_API_KEY/i.test(res.lastError)) {
        res.stoppedEarly = true;
        halt = true;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(EXTRACT_CONCURRENCY, Math.max(1, batches.length)) }, worker));
  return res;
}
