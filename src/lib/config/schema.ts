import { z } from "zod";

/** Zod shapes that mirror config/seed.json exactly. Extra keys are kept. */

export const fundProfileSchema = z.looseObject({
  name: z.string().min(1),
  type: z.string().default("Family office"),
  location: z.string().default("Bengaluru, India"),
  tagline: z.string().default(""),
  timezone: z.string().default("Asia/Kolkata"),
  digest_day: z.string().default("Monday"),
  digest_time: z.string().default("07:00"),
  display_currency: z.array(z.string()).default(["INR crore", "USD"]),
  usd_inr_rate: z.number().positive(),
  usd_inr_rate_note: z.string().optional(),
});

export const stageSchema = z.looseObject({
  name: z.string().min(1),
  focus: z.boolean(),
  follow_on_only: z.boolean().default(false),
});

export const mandateSchema = z.looseObject({
  geography: z.string().default("India"),
  focus_sectors: z.array(z.string()),
  other_sectors_to_note: z.boolean().default(true),
  stages: z.array(stageSchema),
  ticket_size_usd: z.looseObject({
    min: z.number().nullable().default(null),
    max: z.number().nullable().default(null),
    note: z.string().optional(),
  }),
});

export const taxonomySchema = z.looseObject({
  sectors: z.record(z.string(), z.array(z.string())),
  stages: z.array(z.string()),
});

export const senderProfileSchema = z.looseObject({
  name: z.string(),
  title: z.string().default(""),
  organisation: z.string().default(""),
  intro_line: z.string().default(""),
  outreach_tone: z.string().default(""),
});

/** The seed only has some of these. The rest get defaults so nothing is hard-coded in code. */
/** A whole number kept inside sensible limits. Out-of-range values are clamped, never rejected, so stored settings always load. */
const bounded = (min: number, max: number, fallback: number) =>
  z
    .number()
    .default(fallback)
    .transform((v) => Math.min(max, Math.max(min, Math.round(v))));

export const digestSettingsSchema = z.looseObject({
  recipients: z.array(z.string().email("Each recipient must be a valid email address")).default([]),
  lookback_days: bounded(1, 30, 7),
  highlights_top: z.number().int().min(1).default(5),
  highlights_total: z.number().int().min(1).default(15),
  backfill_weeks: z.number().int().min(1).default(8),
  baseline_weeks: z.number().int().min(1).default(4),
  acceleration_ratio: z.number().positive().default(1.25),
  slowing_ratio: z.number().positive().default(0.75),
  min_baseline_deals: z.number().int().min(0).default(3),
  min_extra_deals: z.number().int().min(0).default(2),
  daily_send_cap: bounded(1, 100, 20),
  fuzzy_match_review_threshold: z.number().min(0).max(1).default(0.85),
  refresh_cooldown_minutes: bounded(5, 1440, 30),
  ask_per_ip_per_hour: bounded(1, 100, 10),
  ask_daily_cap: bounded(1, 2000, 200),
  send_per_ip_per_hour: bounded(1, 20, 5),
  search_cache_hours: z.number().min(0).default(24),
  max_search_queries_per_run: bounded(0, 100, 30),
  extraction_batch_size: bounded(1, 10, 5),
  max_article_chars: bounded(500, 20000, 6000),
  max_articles_per_run: bounded(1, 100, 40),
  typical_weekly_volume_min: z.number().int().min(0).default(40),
  typical_weekly_volume_max: z.number().int().min(0).default(60),
  adjacency_window_days: z.number().int().min(1).default(10),
  adjacency_min_shared_terms: z.number().int().min(1).default(2),
  adjacency_cluster_min_companies: z.number().int().min(2).default(2),
});

export const sourceSchema = z.looseObject({
  outlet: z.string().min(1),
  kind: z.string().default("startup_media"),
  site: z.string().min(1),
  feed_url: z.string().nullable().default(null),
  note: z.string().default(""),
  enabled: z.boolean().default(true),
});

export const sourcesSchema = z.looseObject({
  rss_and_sites: z.array(sourceSchema),
  feed_url_note: z.string().optional(),
  linkedin_via_search: z.looseObject({
    enabled: z.boolean().default(true),
    include_domain: z.string().default("linkedin.com"),
    query_templates: z.array(z.string()).default([]),
    note: z.string().optional(),
  }),
});

export const searchChainSchema = z.array(
  z.looseObject({
    order: z.number(),
    provider: z.string(),
    env: z.array(z.string()),
    free_tier_note: z.string().optional(),
  }),
);

const companyBase = {
  name: z.string().trim().min(1),
  tag: z.enum(["Portfolio", "On Radar"]),
  sector: z.string().min(1),
  domain: z.string().nullable().default(null),
  description: z.string().nullable().optional(),
  aliases: z.array(z.string()).default([]),
  match_requires_context: z.array(z.string()).optional(),
  status: z.string().default("active"),
};

export const companySchema = z.looseObject({
  id: z.string().min(1),
  ...companyBase,
  // On Radar extras. stage_last_seen stays free text because the seed has one value ("Early-stage") outside the stage list.
  stage_last_seen: z.string().nullable().optional(),
  last_round_text: z.string().nullable().optional(),
  investors_reported: z.array(z.string()).optional(),
  reason_on_radar: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  added_on: z.string().nullable().optional(),
  evidence_url: z.string().nullable().optional(),
  evidence_note: z.string().nullable().optional(),
  confidence: z.string().nullable().optional(),
});

/** Used when the user adds or edits a company: id is generated if missing. */
export const companyInputSchema = companySchema.extend({ id: z.string().min(1).optional() });

export const investorSchema = z.looseObject({
  name: z.string().trim().min(1),
  note: z.string().nullable().default(null),
});

export const stakeholderSchema = z.looseObject({
  name: z.string().trim().min(1),
  role: z.string().default(""),
  type: z.enum(["LP", "IC", "portfolio_founder"]),
  email: z.string().email(),
  demo: z.boolean().default(false),
});

export const fullConfigSchema = z.looseObject({
  _meta: z.unknown().optional(),
  fund_profile: fundProfileSchema,
  mandate: mandateSchema,
  taxonomy: taxonomySchema,
  portfolio: z.array(companySchema),
  on_radar: z.array(companySchema),
  investors_of_interest: z.array(investorSchema),
  stakeholders: z.array(stakeholderSchema),
  sender_profile: senderProfileSchema,
  digest_settings: digestSettingsSchema,
  sources: sourcesSchema,
  search_chain: searchChainSchema,
});

export type FundProfile = z.infer<typeof fundProfileSchema>;
export type Mandate = z.infer<typeof mandateSchema>;
export type Taxonomy = z.infer<typeof taxonomySchema>;
export type SenderProfile = z.infer<typeof senderProfileSchema>;
export type DigestSettings = z.infer<typeof digestSettingsSchema>;
export type Sources = z.infer<typeof sourcesSchema>;
export type SourceEntry = z.infer<typeof sourceSchema>;
export type SearchChain = z.infer<typeof searchChainSchema>;
export type CompanyJson = z.infer<typeof companySchema>;
export type CompanyInput = z.infer<typeof companyInputSchema>;
export type InvestorJson = z.infer<typeof investorSchema>;
export type StakeholderJson = z.infer<typeof stakeholderSchema>;
export type FullConfig = z.infer<typeof fullConfigSchema>;

export const CONFIG_BLOCKS = [
  "fund_profile",
  "mandate",
  "taxonomy",
  "sender_profile",
  "digest_settings",
  "sources",
  "search_chain",
] as const;
export type ConfigBlock = (typeof CONFIG_BLOCKS)[number];

export const blockSchemas = {
  fund_profile: fundProfileSchema,
  mandate: mandateSchema,
  taxonomy: taxonomySchema,
  sender_profile: senderProfileSchema,
  digest_settings: digestSettingsSchema,
  sources: sourcesSchema,
  search_chain: searchChainSchema,
} as const;
