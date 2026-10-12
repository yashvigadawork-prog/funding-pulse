/** Section 3: founder outreach, portfolio follow-up and the LP brief, built from a prepared digest. */
import { eq } from "drizzle-orm";
import { stageLabel } from "@/lib/format";
import { db } from "@/db";
import { founderLeads } from "@/db/schema";
import { getBlocks, listCompanies, listStakeholders } from "@/lib/config/store";
import { normalizeName } from "@/lib/matching";
import { scrubDeep } from "@/lib/forbidden";
import { amountLabel } from "@/lib/money";
import type { PreparedDigest } from "@/lib/pipeline/digest";
import { SearchBudget } from "@/lib/search";
import { formatWeekStart } from "@/lib/time";
import { appUrl } from "@/lib/url";
import { findContact } from "./contacts";
import { founderEmailDraft, linkedinNoteDraft, lpBriefDraft, lpBullets, portfolioFollowUpDraft } from "./drafts";
import type { ActionsBlock, FollowUp, FounderLead } from "./types";

const OUTREACH_COUNT = 5;

export async function buildActions(prep: PreparedDigest, deadline: number = Date.now() + 120_000): Promise<ActionsBlock> {
  const blocks = await getBlocks();
  const [companies, stakeholders] = await Promise.all([listCompanies(), listStakeholders()]);
  const sender = blocks.sender_profile;
  const settings = blocks.digest_settings;
  const byId = new Map(companies.map((c) => [c.id, c]));
  const ranked = new Map(prep.candidates.map((c) => [c.dealId, c.rank]));

  /* ---- founder outreach: five companies from focus deals and On Radar ---- */
  type Pick = { company: string; companyId: string | null; domain: string | null; tag: "Portfolio" | "On Radar" | null; why: string; dealId: number | null; stage: string | null; amountText: string | null; amountUsd: number | null; amountInr: number | null; sector: string | null; summary: string | null; sourceUrl: string | null; sources: { url: string; outlet: string | null }[]; founders: { name: string; role?: string | null }[] };
  const picks: Pick[] = [];
  const seen = new Set<string>();
  const add = (p: Pick) => {
    const k = normalizeName(p.company);
    if (!k || seen.has(k) || picks.length >= OUTREACH_COUNT) return;
    seen.add(k);
    picks.push(p);
  };
  const focusViews = prep.views
    .filter((v) => prep.compute.focusDealIds.includes(v.id) && (v.needsReview || v.matchTag !== "Portfolio"))
    .sort((a, b) => (ranked.get(a.id) ?? 99) - (ranked.get(b.id) ?? 99));
  const fromView = (v: (typeof prep.views)[number], why: string): Pick => ({
    company: v.companyName,
    companyId: v.companyId,
    domain: v.domain ?? (v.companyId ? (byId.get(v.companyId)?.domain ?? null) : null),
    tag: v.matchTag,
    why,
    dealId: v.id,
    stage: v.stage,
    amountText: v.amountText,
    amountUsd: v.amountUsd,
    amountInr: v.amountInr,
    sector: v.sector,
    summary: v.summary,
    sourceUrl: v.sources[0]?.url ?? null,
    sources: v.sources.map((s) => ({ url: s.url, outlet: s.outlet })),
    founders: v.founders,
  });
  for (const v of focusViews.slice(0, 3)) add(fromView(v, `Focus deal: ${stageLabel(v.stage)} in ${v.sector}`));
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const radar = companies.filter((c) => c.tag === "On Radar").sort((a, b) => (priorityRank[a.priority ?? "low"] ?? 3) - (priorityRank[b.priority ?? "low"] ?? 3));
  for (const c of radar) {
    const v = prep.views.find((x) => x.companyId === c.id);
    if (v) add(fromView(v, `On Radar company in the news this week${c.priority ? ` (${c.priority} priority)` : ""}`));
  }
  for (const c of radar) {
    add({
      company: c.name,
      companyId: c.id,
      domain: c.domain,
      tag: "On Radar",
      why: `On Radar${c.priority ? ` (${c.priority} priority)` : ""}: ${c.reason_on_radar ?? "tracked company"}`,
      dealId: null,
      stage: c.stage_last_seen ?? null,
      amountText: c.last_round_text ?? null,
      amountUsd: null,
      amountInr: null,
      sector: c.sector,
      summary: c.description ?? null,
      sourceUrl: c.evidence_url ?? null,
      sources: c.evidence_url ? [{ url: c.evidence_url, outlet: "Source in your On Radar list" }] : [],
      founders: [],
    });
  }
  for (const v of focusViews.slice(3)) add(fromView(v, `Focus deal: ${stageLabel(v.stage)} in ${v.sector}`));

  const budget = new SearchBudget(Math.min(10, Math.max(0, settings.max_search_queries_per_run)));
  const none = { founder: null, founderSource: null, linkedinUrl: null, linkedinSource: null, email: null, emailSource: null };
  const outreach: FounderLead[] = await Promise.all(
    picks.map(async (p) => {
    const known = p.founders[0] && p.sourceUrl ? { name: p.founders[0].name, source: p.sourceUrl } : null;
    // Out of time: keep the company on the list, but say the contact was not looked up rather than guess.
    const c = Date.now() > deadline ? (known ? { ...none, founder: known.name, founderSource: known.source } : none) : await findContact({
      company: p.company,
      domain: p.domain,
      knownFounder: known,
      ctx: { chain: blocks.search_chain, settings, budget, linkedinEnabled: blocks.sources.linkedin_via_search.enabled },
    }).catch(() => none);
    const facts = { company: p.company, founder: c.founder, stage: p.stage, amountText: p.amountText, amountUsd: p.amountUsd, amountInr: p.amountInr, sector: p.sector, summary: p.summary, sourceUrl: p.sourceUrl, outlet: p.sources[0]?.outlet ?? null };
    return {
      company: p.company,
      companyId: p.companyId,
      domain: p.domain,
      tag: p.tag,
      why: p.why,
      founder: c.founder,
      founderSource: c.founderSource,
      linkedinUrl: c.linkedinUrl,
      linkedinSource: c.linkedinSource,
      email: c.email,
      emailSource: c.emailSource,
      found: { founder: !!c.founder, linkedin: !!c.linkedinUrl, email: !!c.email },
      dealId: p.dealId,
      sources: p.sources,
      emailDraft: founderEmailDraft(facts, sender),
      linkedinDraft: linkedinNoteDraft(facts, sender),
    } satisfies FounderLead;
    }),
  );
  await db.delete(founderLeads).where(eq(founderLeads.weekStart, prep.week));
  if (outreach.length)
    await db.insert(founderLeads).values(
      outreach.map((o) => ({
        weekStart: prep.week,
        company: o.company,
        founder: o.founder,
        linkedinUrl: o.linkedinUrl,
        email: o.email,
        foundFlags: { ...o.found, founderSource: o.founderSource, linkedinSource: o.linkedinSource, emailSource: o.emailSource },
        drafts: { email: o.emailDraft, linkedin: o.linkedinDraft },
      })),
    );

  /* ---- portfolio follow-up: named directly, or something adjacent / a cluster ---- */
  const pickStakeholder = (kind: FollowUp["reason"]) => {
    const want = kind === "named" ? ["portfolio_founder", "IC", "LP"] : ["IC", "portfolio_founder", "LP"];
    for (const t of want) {
      const s = stakeholders.find((x) => x.type === t);
      if (s) return s;
    }
    return null;
  };
  const followUps = new Map<string, FollowUp>();
  for (const v of prep.views.filter((x) => x.matchTag === "Portfolio" && !x.needsReview && x.companyId)) {
    const co = byId.get(v.companyId!);
    if (!co) continue;
    const st = pickStakeholder("named");
    followUps.set(co.id, {
      companyId: co.id,
      company: co.name,
      domain: co.domain,
      reason: "named",
      headline: `${co.name} was named in the news: ${stageLabel(v.stage)}, ${v.amountUsd !== null ? amountLabel(v) : "amount undisclosed"}`,
      stakeholder: st ? { name: st.name, role: st.role, email: st.email, type: st.type, demo: st.demo } : null,
      draft: portfolioFollowUpDraft({ kind: "named", company: co.name, recipientName: st?.name ?? null, named: [{ stage: v.stage, amountText: v.amountText, amountUsd: v.amountUsd, amountInr: v.amountInr, sourceUrl: v.sources[0]?.url ?? null }], adjacent: [], windowDays: settings.adjacency_window_days }, sender),
      sources: v.sources.map((s) => ({ url: s.url, outlet: s.outlet })),
    });
  }
  for (const g of prep.adjacency) {
    if (followUps.has(g.portfolioId)) continue;
    const co = byId.get(g.portfolioId);
    const reason: FollowUp["reason"] = g.cluster ? "cluster" : "adjacent";
    const st = pickStakeholder(reason);
    followUps.set(g.portfolioId, {
      companyId: g.portfolioId,
      company: g.portfolioName,
      domain: co?.domain ?? null,
      reason,
      headline: g.cluster ? `${g.companies} companies in the same space as ${g.portfolioName} raised within ${g.windowDays} days` : `A company in the same space as ${g.portfolioName} raised recently`,
      stakeholder: st ? { name: st.name, role: st.role, email: st.email, type: st.type, demo: st.demo } : null,
      draft: portfolioFollowUpDraft(
        {
          kind: reason,
          company: g.portfolioName,
          recipientName: st?.name ?? null,
          named: [],
          adjacent: g.items.map((i) => ({ company: i.companyName, stage: i.stage, amountText: i.amountText, amountUsd: i.amountUsd, amountInr: i.amountInr, sharedTerms: i.sharedTerms, sourceUrl: i.sources[0]?.url ?? null })),
          windowDays: g.windowDays,
        },
        sender,
      ),
      sources: g.items.flatMap((i) => i.sources).filter((s, idx, arr) => arr.findIndex((x) => x.url === s.url) === idx),
    });
  }
  const portfolioFollowUp = [...followUps.values()].sort((a, b) => ({ cluster: 0, named: 1, adjacent: 2 })[a.reason] - { cluster: 0, named: 1, adjacent: 2 }[b.reason]);

  /* ---- LP brief ---- */
  const k = prep.compute.kpis;
  const reportUrl = `${appUrl()}/report/${prep.week}`;
  const top = prep.candidates.slice(0, settings.highlights_top).flatMap((c) => {
    const v = prep.views.find((x) => x.id === c.dealId);
    return v ? [{ company: v.companyName, stage: v.stage, amountText: v.amountText, sourceUrl: v.sources[0]?.url ?? null, why: c.why }] : [];
  });
  const { bullets, leadSectors } = lpBullets(prep.compute.capital, prep.compute.trends);
  const near = prep.adjacency.find((g) => g.cluster) ?? prep.adjacency[0];
  const lpPerson = stakeholders.find((x) => x.type === "LP" && !x.demo) ?? null;
  const lp = lpBriefDraft(
    {
      fundName: blocks.fund_profile.name,
      weekStartLabel: formatWeekStart(prep.week),
      recipientName: lpPerson?.name ?? null,
      deals: k.deals,
      bullets,
      leadSectors,
      nearby: near ? { companies: near.companies, sector: near.sector, windowDays: near.windowDays, portfolioName: near.portfolioName } : null,
      reportUrl,
    },
    sender,
  );
  return scrubDeep({
    founderOutreach: outreach,
    portfolioFollowUp,
    lpBrief: { draft: lp, keyPoints: top.map((t) => ({ text: `${t.company}: ${t.why}`, url: t.sourceUrl })), reportPath: `/report/${prep.week}` },
    generatedAt: new Date().toISOString(),
  });
}
