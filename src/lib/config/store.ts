import { asc, eq, sql } from "drizzle-orm";
import seedJson from "../../../config/seed.json";
import { db } from "@/db";
import {
  companies,
  configEditLog,
  fundConfig,
  investorsOfInterest,
  stakeholders,
  type Company,
} from "@/db/schema";
import {
  blockSchemas,
  CONFIG_BLOCKS,
  fullConfigSchema,
  type CompanyInput,
  type CompanyJson,
  type ConfigBlock,
  type DigestSettings,
  type FullConfig,
  type FundProfile,
  type InvestorJson,
  type Mandate,
  type SenderProfile,
  type Sources,
  type StakeholderJson,
  type Taxonomy,
} from "./schema";

/* ---------------- seed ---------------- */

let seedCache: FullConfig | null = null;
export function loadSeed(): FullConfig {
  if (!seedCache) seedCache = fullConfigSchema.parse(seedJson);
  return seedCache;
}

/* ---------------- row <-> json ---------------- */

function companyToRow(c: CompanyJson) {
  return {
    id: c.id,
    name: c.name,
    tag: c.tag,
    sector: c.sector,
    domain: c.domain ?? null,
    description: c.description ?? null,
    aliases: c.aliases ?? [],
    matchRequiresContext: c.match_requires_context ?? [],
    status: c.status ?? (c.tag === "Portfolio" ? "active" : "tracking"),
    stageLastSeen: c.stage_last_seen ?? null,
    lastRoundText: c.last_round_text ?? null,
    investorsReported: c.investors_reported ?? null,
    reasonOnRadar: c.reason_on_radar ?? null,
    priority: c.priority ?? null,
    addedOn: c.added_on ?? null,
    evidenceUrl: c.evidence_url ?? null,
    evidenceNote: c.evidence_note ?? null,
    confidence: c.confidence ?? null,
  };
}

export function rowToCompany(r: Company): CompanyJson {
  const out: Record<string, unknown> = {
    id: r.id,
    name: r.name,
    tag: r.tag,
    sector: r.sector,
    domain: r.domain,
  };
  if (r.description) out.description = r.description;
  out.aliases = r.aliases ?? [];
  if (r.matchRequiresContext?.length) out.match_requires_context = r.matchRequiresContext;
  out.status = r.status;
  if (r.tag === "On Radar") {
    out.stage_last_seen = r.stageLastSeen;
    out.last_round_text = r.lastRoundText;
    out.investors_reported = r.investorsReported ?? [];
    out.reason_on_radar = r.reasonOnRadar;
    out.priority = r.priority;
    if (r.addedOn) out.added_on = r.addedOn;
    out.evidence_url = r.evidenceUrl;
    out.evidence_note = r.evidenceNote;
    out.confidence = r.confidence;
  }
  return out as CompanyJson;
}

/* ---------------- seeding ---------------- */

let seededThisProcess = false;

/** Fills an empty database from the seed. Existing rows are never touched, so running it twice changes nothing. */
export async function seedIfMissing(): Promise<{ inserted: { companies: number; investors: number; stakeholders: number; config: boolean } }> {
  const seed = loadSeed();
  const cfgRows = await db
    .insert(fundConfig)
    .values({
      id: 1,
      profile: seed.fund_profile,
      mandate: seed.mandate,
      taxonomy: seed.taxonomy,
      senderProfile: seed.sender_profile,
      digestSettings: seed.digest_settings,
      sources: seed.sources,
      searchChain: seed.search_chain,
    })
    .onConflictDoNothing()
    .returning({ id: fundConfig.id });

  const rows = [...seed.portfolio, ...seed.on_radar].map(companyToRow);
  let insertedCompanies = 0;
  for (let i = 0; i < rows.length; i += 60) {
    const res = await db
      .insert(companies)
      .values(rows.slice(i, i + 60))
      .onConflictDoNothing()
      .returning({ id: companies.id });
    insertedCompanies += res.length;
  }
  const inv = await db
    .insert(investorsOfInterest)
    .values(seed.investors_of_interest.map((i) => ({ name: i.name, note: i.note ?? null })))
    .onConflictDoNothing()
    .returning({ id: investorsOfInterest.id });
  const stk = await db
    .insert(stakeholders)
    .values(seed.stakeholders.map((s) => ({ name: s.name, role: s.role, type: s.type, email: s.email, demo: s.demo })))
    .onConflictDoNothing()
    .returning({ id: stakeholders.id });
  return {
    inserted: { companies: insertedCompanies, investors: inv.length, stakeholders: stk.length, config: cfgRows.length > 0 },
  };
}

/** Called by the app so a fresh database fills itself on first use. */
export async function ensureSeeded(): Promise<void> {
  if (seededThisProcess) return;
  const rows = await db.select({ id: fundConfig.id }).from(fundConfig).limit(1);
  if (!rows.length) await seedIfMissing();
  seededThisProcess = true;
}

/* ---------------- reading ---------------- */

export interface ConfigBlocks {
  fund_profile: FundProfile;
  mandate: Mandate;
  taxonomy: Taxonomy;
  sender_profile: SenderProfile;
  digest_settings: DigestSettings;
  sources: Sources;
  search_chain: FullConfig["search_chain"];
}

export async function getBlocks(): Promise<ConfigBlocks> {
  await ensureSeeded();
  const [row] = await db.select().from(fundConfig).where(eq(fundConfig.id, 1)).limit(1);
  return {
    fund_profile: blockSchemas.fund_profile.parse(row.profile),
    mandate: blockSchemas.mandate.parse(row.mandate),
    taxonomy: blockSchemas.taxonomy.parse(row.taxonomy),
    sender_profile: blockSchemas.sender_profile.parse(row.senderProfile),
    digest_settings: blockSchemas.digest_settings.parse(row.digestSettings),
    sources: blockSchemas.sources.parse(row.sources),
    search_chain: blockSchemas.search_chain.parse(row.searchChain),
  };
}

export async function getSettings(): Promise<DigestSettings> {
  return (await getBlocks()).digest_settings;
}

export async function listCompanies(tag?: "Portfolio" | "On Radar"): Promise<CompanyJson[]> {
  await ensureSeeded();
  const q = db.select().from(companies);
  const rows = await (tag ? q.where(eq(companies.tag, tag)) : q).orderBy(asc(sql`lower(${companies.name})`));
  return rows.map(rowToCompany);
}

export async function listInvestors(): Promise<(InvestorJson & { id: number })[]> {
  await ensureSeeded();
  const rows = await db.select().from(investorsOfInterest).orderBy(asc(investorsOfInterest.id));
  return rows.map((r) => ({ id: r.id, name: r.name, note: r.note }));
}

export async function listStakeholders(): Promise<(StakeholderJson & { id: number })[]> {
  await ensureSeeded();
  const rows = await db.select().from(stakeholders).orderBy(asc(stakeholders.id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role ?? "",
    type: r.type as StakeholderJson["type"],
    email: r.email,
    demo: r.demo,
  }));
}

/** The whole configuration in exactly the seed's shape (this is what Export gives). */
export async function getFullConfig(): Promise<FullConfig> {
  const blocks = await getBlocks();
  const [all, inv, stk] = await Promise.all([listCompanies(), listInvestors(), listStakeholders()]);
  return {
    _meta: { ...(loadSeed()._meta as object), exported_at: new Date().toISOString() },
    fund_profile: blocks.fund_profile,
    mandate: blocks.mandate,
    taxonomy: blocks.taxonomy,
    portfolio: all.filter((c) => c.tag === "Portfolio"),
    on_radar: all.filter((c) => c.tag === "On Radar"),
    investors_of_interest: inv.map(({ name, note }) => ({ name, note })),
    stakeholders: stk.map(({ name, role, type, email, demo }) => ({ name, role, type, email, demo })),
    sender_profile: blocks.sender_profile,
    digest_settings: blocks.digest_settings,
    sources: blocks.sources,
    search_chain: blocks.search_chain,
  };
}

/* ---------------- writing ---------------- */

export async function logEdit(entity: string, entityId: string | null, action: string, before: unknown, after: unknown) {
  await db.insert(configEditLog).values({
    entity,
    entityId,
    action,
    before: before ?? null,
    after: after ?? null,
  });
}

export async function listEditLog(limit = 50) {
  return db.select().from(configEditLog).orderBy(sql`${configEditLog.id} desc`).limit(limit);
}

/** Replaces everything at once (used by Import and Reset). All-or-nothing in one batch. */
export async function replaceAll(cfg: FullConfig, action: "import" | "reset"): Promise<void> {
  await ensureSeeded();
  const rows = [...cfg.portfolio, ...cfg.on_radar].map(companyToRow);
  const stmts = [
    db.delete(companies),
    db.delete(investorsOfInterest),
    db.delete(stakeholders),
    db
      .insert(fundConfig)
      .values({
        id: 1,
        profile: cfg.fund_profile,
        mandate: cfg.mandate,
        taxonomy: cfg.taxonomy,
        senderProfile: cfg.sender_profile,
        digestSettings: cfg.digest_settings,
        sources: cfg.sources,
        searchChain: cfg.search_chain,
      })
      .onConflictDoUpdate({
        target: fundConfig.id,
        set: {
          profile: cfg.fund_profile,
          mandate: cfg.mandate,
          taxonomy: cfg.taxonomy,
          senderProfile: cfg.sender_profile,
          digestSettings: cfg.digest_settings,
          sources: cfg.sources,
          searchChain: cfg.search_chain,
          updatedAt: new Date(),
        },
      }),
  ];
  for (let i = 0; i < rows.length; i += 60) stmts.push(db.insert(companies).values(rows.slice(i, i + 60)) as never);
  if (cfg.investors_of_interest.length)
    stmts.push(
      db.insert(investorsOfInterest).values(cfg.investors_of_interest.map((i) => ({ name: i.name, note: i.note ?? null }))) as never,
    );
  if (cfg.stakeholders.length)
    stmts.push(
      db
        .insert(stakeholders)
        .values(cfg.stakeholders.map((s) => ({ name: s.name, role: s.role, type: s.type, email: s.email, demo: s.demo }))) as never,
    );
  stmts.push(
    db.insert(configEditLog).values({
      entity: "config",
      entityId: null,
      action,
      before: null,
      after: { portfolio: cfg.portfolio.length, on_radar: cfg.on_radar.length },
    }) as never,
  );
  await db.batch(stmts as unknown as [(typeof stmts)[0], ...(typeof stmts)[0][]]);
}

export async function resetToDefaults() {
  await replaceAll(loadSeed(), "reset");
}

export async function importConfig(raw: unknown): Promise<{ portfolio: number; on_radar: number }> {
  const cfg = fullConfigSchema.parse(raw);
  // The two company lists must carry the right tag, and names must be unique.
  for (const c of cfg.portfolio) c.tag = "Portfolio";
  for (const c of cfg.on_radar) c.tag = "On Radar";
  const seen = new Set<string>();
  for (const c of [...cfg.portfolio, ...cfg.on_radar]) {
    const k = c.name.toLowerCase();
    if (seen.has(k)) throw new Error(`Duplicate company name in file: ${c.name}`);
    seen.add(k);
  }
  await replaceAll(cfg, "import");
  return { portfolio: cfg.portfolio.length, on_radar: cfg.on_radar.length };
}

export function isConfigBlock(s: string): s is ConfigBlock {
  return (CONFIG_BLOCKS as readonly string[]).includes(s);
}

export async function saveBlock(block: ConfigBlock, value: unknown) {
  const parsed = blockSchemas[block].parse(value);
  const before = (await getBlocks())[block];
  const col = {
    fund_profile: "profile",
    mandate: "mandate",
    taxonomy: "taxonomy",
    sender_profile: "senderProfile",
    digest_settings: "digestSettings",
    sources: "sources",
    search_chain: "searchChain",
  }[block] as keyof typeof fundConfig.$inferInsert;
  await db
    .update(fundConfig)
    .set({ [col]: parsed, updatedAt: new Date() } as never)
    .where(eq(fundConfig.id, 1));
  await logEdit(block, null, "update", before, parsed);
  return parsed;
}

/* ---- companies ---- */

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "company"
  );
}

export async function createCompany(input: CompanyInput): Promise<CompanyJson> {
  await ensureSeeded();
  const dup = await db.select({ id: companies.id }).from(companies).where(sql`lower(${companies.name}) = ${input.name.toLowerCase()}`).limit(1);
  if (dup.length) throw new Error(`A company called "${input.name}" already exists`);
  let id = input.id ?? slugify(input.name);
  const taken = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, id)).limit(1);
  if (taken.length) id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
  const status = input.status || (input.tag === "Portfolio" ? "active" : "tracking");
  const row = companyToRow({
    ...input,
    id,
    status,
    ...(input.tag === "On Radar" ? { added_on: input.added_on ?? new Date().toISOString().slice(0, 10) } : {}),
  } as CompanyJson);
  const [saved] = await db.insert(companies).values(row).returning();
  const json = rowToCompany(saved);
  await logEdit("company", id, "create", null, json);
  return json;
}

export async function updateCompany(id: string, input: CompanyInput): Promise<CompanyJson> {
  const [before] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!before) throw new Error("Company not found");
  const dup = await db
    .select({ id: companies.id })
    .from(companies)
    .where(sql`lower(${companies.name}) = ${input.name.toLowerCase()} and ${companies.id} <> ${id}`)
    .limit(1);
  if (dup.length) throw new Error(`A company called "${input.name}" already exists`);
  const row = companyToRow({ ...input, id } as CompanyJson);
  const { id: _omit, ...set } = row;
  void _omit;
  const [saved] = await db
    .update(companies)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning();
  const json = rowToCompany(saved);
  await logEdit("company", id, "update", rowToCompany(before), json);
  return json;
}

export async function deleteCompany(id: string) {
  const [before] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!before) throw new Error("Company not found");
  await db.delete(companies).where(eq(companies.id, id));
  await logEdit("company", id, "delete", rowToCompany(before), null);
}

/* ---- investors of interest ---- */

export async function createInvestor(input: InvestorJson) {
  await ensureSeeded();
  const dup = await db.select({ id: investorsOfInterest.id }).from(investorsOfInterest).where(eq(investorsOfInterest.name, input.name)).limit(1);
  if (dup.length) throw new Error(`"${input.name}" is already on the list`);
  const [saved] = await db.insert(investorsOfInterest).values({ name: input.name, note: input.note ?? null }).returning();
  await logEdit("investor", String(saved.id), "create", null, saved);
  return saved;
}

export async function updateInvestor(id: number, input: InvestorJson) {
  const [before] = await db.select().from(investorsOfInterest).where(eq(investorsOfInterest.id, id)).limit(1);
  if (!before) throw new Error("Investor not found");
  const [saved] = await db.update(investorsOfInterest).set({ name: input.name, note: input.note ?? null }).where(eq(investorsOfInterest.id, id)).returning();
  await logEdit("investor", String(id), "update", before, saved);
  return saved;
}

export async function deleteInvestor(id: number) {
  const [before] = await db.select().from(investorsOfInterest).where(eq(investorsOfInterest.id, id)).limit(1);
  if (!before) throw new Error("Investor not found");
  await db.delete(investorsOfInterest).where(eq(investorsOfInterest.id, id));
  await logEdit("investor", String(id), "delete", before, null);
}

/* ---- stakeholders ---- */

export async function createStakeholder(input: StakeholderJson) {
  await ensureSeeded();
  const dup = await db.select({ id: stakeholders.id }).from(stakeholders).where(eq(stakeholders.email, input.email)).limit(1);
  if (dup.length) throw new Error(`${input.email} is already in the address book`);
  const demo = input.demo || /@example\.com$/i.test(input.email);
  const [saved] = await db.insert(stakeholders).values({ ...input, demo }).returning();
  await logEdit("stakeholder", String(saved.id), "create", null, saved);
  return saved;
}

export async function updateStakeholder(id: number, input: StakeholderJson) {
  const [before] = await db.select().from(stakeholders).where(eq(stakeholders.id, id)).limit(1);
  if (!before) throw new Error("Contact not found");
  const demo = input.demo || /@example\.com$/i.test(input.email);
  const [saved] = await db.update(stakeholders).set({ ...input, demo }).where(eq(stakeholders.id, id)).returning();
  await logEdit("stakeholder", String(id), "update", before, saved);
  return saved;
}

export async function deleteStakeholder(id: number) {
  const [before] = await db.select().from(stakeholders).where(eq(stakeholders.id, id)).limit(1);
  if (!before) throw new Error("Contact not found");
  await db.delete(stakeholders).where(eq(stakeholders.id, id));
  await logEdit("stakeholder", String(id), "delete", before, null);
}
