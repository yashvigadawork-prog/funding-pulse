import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/* ------------------------------------------------------------------ */
/* Config tables (loaded from the seed, edited from the sidebar)       */
/* ------------------------------------------------------------------ */

export const fundConfig = pgTable("fund_config", {
  id: integer("id").primaryKey().default(1),
  profile: jsonb("profile").notNull(),
  mandate: jsonb("mandate").notNull(),
  taxonomy: jsonb("taxonomy").notNull(),
  senderProfile: jsonb("sender_profile").notNull(),
  digestSettings: jsonb("digest_settings").notNull(),
  sources: jsonb("sources").notNull(),
  searchChain: jsonb("search_chain").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const companies = pgTable(
  "companies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    tag: text("tag").notNull(), // 'Portfolio' | 'On Radar'
    sector: text("sector").notNull(),
    domain: text("domain"),
    description: text("description"),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    matchRequiresContext: text("match_requires_context")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: text("status").notNull().default("active"),
    // On Radar only
    stageLastSeen: text("stage_last_seen"),
    lastRoundText: text("last_round_text"),
    investorsReported: text("investors_reported").array(),
    reasonOnRadar: text("reason_on_radar"),
    priority: text("priority"),
    addedOn: text("added_on"),
    evidenceUrl: text("evidence_url"),
    evidenceNote: text("evidence_note"),
    confidence: text("confidence"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("companies_name_lower_uq").on(sql`lower(${t.name})`),
    index("companies_tag_idx").on(t.tag),
  ],
);

export const investorsOfInterest = pgTable("investors_of_interest", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  note: text("note"),
});

export const stakeholders = pgTable("stakeholders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role"),
  type: text("type").notNull(), // 'LP' | 'IC' | 'portfolio_founder'
  email: text("email").notNull().unique(),
  demo: boolean("demo").notNull().default(false),
});

export const configEditLog = pgTable("config_edit_log", {
  id: serial("id").primaryKey(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  action: text("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  at: ts("at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Pipeline tables                                                     */
/* ------------------------------------------------------------------ */

export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    url: text("url").notNull().unique(),
    outlet: text("outlet"),
    title: text("title"),
    publishedAt: ts("published_at"),
    textHash: text("text_hash"),
    text: text("text"), // truncated article text kept so extraction can be resumed
    kind: text("kind").notNull().default("article"), // 'article' | 'roundup' | 'linkedin'
    via: text("via"), // 'feed' | search provider name | 'paste'
    extracted: jsonb("extracted"), // what Gemini pulled out of the text (kept so work is never repeated)
    attempts: integer("attempts").notNull().default(0), // extraction tries, to stop endless retries
    processed: boolean("processed").notNull().default(false),
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
  },
  (t) => [index("articles_processed_idx").on(t.processed)],
);

export const deals = pgTable(
  "deals",
  {
    id: serial("id").primaryKey(),
    companyName: text("company_name").notNull(),
    companyId: text("company_id"),
    matchTag: text("match_tag"),
    matchReason: text("match_reason"),
    needsReview: boolean("needs_review").notNull().default(false),
    stage: text("stage"),
    amountUsd: doublePrecision("amount_usd"),
    amountInr: doublePrecision("amount_inr"),
    amountMinUsd: doublePrecision("amount_min_usd"),
    amountMaxUsd: doublePrecision("amount_max_usd"),
    amountText: text("amount_text"),
    sector: text("sector"),
    announcedOn: date("announced_on", { mode: "string" }),
    weekStart: date("week_start", { mode: "string" }),
    confidence: text("confidence").notNull().default("medium"), // high | medium | low
    summary: text("summary"),
    domain: text("domain"),
    founders: jsonb("founders"),
    dedupeKey: text("dedupe_key"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("deals_week_idx").on(t.weekStart),
    index("deals_company_idx").on(sql`lower(${t.companyName})`),
  ],
);

export const dealSources = pgTable(
  "deal_sources",
  {
    dealId: integer("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.dealId, t.articleId] })],
);

export const investors = pgTable("investors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  firstSeen: date("first_seen", { mode: "string" }),
});

export const dealInvestors = pgTable(
  "deal_investors",
  {
    dealId: integer("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    investorId: integer("investor_id")
      .notNull()
      .references(() => investors.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("participant"), // 'lead' | 'participant'
  },
  (t) => [primaryKey({ columns: [t.dealId, t.investorId] })],
);

export const digests = pgTable("digests", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start", { mode: "string" }).notNull().unique(),
  kpis: jsonb("kpis").notNull(),
  highlights: jsonb("highlights").notNull(),
  patterns: jsonb("patterns").notNull(),
  analysis: jsonb("analysis").notNull(),
  actions: jsonb("actions").notNull(),
  emailedAt: ts("emailed_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const founderLeads = pgTable("founder_leads", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start", { mode: "string" }).notNull(),
  company: text("company").notNull(),
  founder: text("founder"),
  linkedinUrl: text("linkedin_url"),
  email: text("email"),
  foundFlags: jsonb("found_flags"),
  drafts: jsonb("drafts"),
});

export const sentEmails = pgTable("sent_emails", {
  id: serial("id").primaryKey(),
  recipient: text("recipient").notNull(),
  type: text("type").notNull(),
  subject: text("subject"),
  sentAt: ts("sent_at").notNull().defaultNow(),
  status: text("status").notNull(),
  error: text("error"),
});

export const runs = pgTable(
  "runs",
  {
    id: serial("id").primaryKey(),
    runId: text("run_id").notNull(),
    step: text("step").notNull(),
    status: text("status").notNull(), // running | ok | error | skipped
    kind: text("kind").notNull().default("refresh"), // refresh | weekly | backfill
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    message: text("message"),
    counts: jsonb("counts"),
  },
  (t) => [index("runs_run_idx").on(t.runId)],
);

/* ------------------------------------------------------------------ */
/* Supporting tables                                                   */
/* ------------------------------------------------------------------ */

export const searchCache = pgTable("search_cache", {
  queryHash: text("query_hash").primaryKey(),
  provider: text("provider").notNull(),
  results: jsonb("results").notNull(),
  fetchedAt: ts("fetched_at").notNull().defaultNow(),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/** One row per named lock (the pipeline uses the name "pipeline"). */
export const locks = pgTable("locks", {
  name: text("name").primaryKey(),
  runId: text("run_id"),
  lockedUntil: ts("locked_until").notNull(),
});

/** Small key/value store for things like the refresh cooldown timestamp. */
export const appState = pgTable("app_state", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Deal = typeof deals.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type Digest = typeof digests.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
