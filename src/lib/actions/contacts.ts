/**
 * Public contact discovery. Everything returned comes from a public search result or a page we fetched,
 * and comes with its source link. Nothing is guessed: an email address is only reported if it is
 * written on a page, never built from a name pattern.
 */
import { z } from "zod";
import { geminiConfigured, geminiJson, escapeForTag, UNTRUSTED_NOTICE } from "@/lib/gemini";
import { getText } from "@/lib/http";
import type { DigestSettings, SearchChain } from "@/lib/config/schema";
import { search, SearchBudget, type SearchResult } from "@/lib/search";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** Email addresses written on a page that belong to the company's own domain. */
export function extractEmails(html: string, domain: string): string[] {
  const d = domain.toLowerCase().replace(/^www\./, "");
  const found = new Set<string>();
  const decoded = html.replace(/&#64;|&commat;|\[at\]/gi, "@").replace(/%40/g, "@");
  for (const m of decoded.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase();
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(e)) continue;
    const host = e.split("@")[1];
    if (host === d || host.endsWith(`.${d}`)) found.add(e);
  }
  return [...found];
}

export function isLinkedInProfile(url: string): boolean {
  return /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#]+/i.test(url);
}

/** Does this person's name really appear in the text? (every name part must be present) */
export function nameAppears(name: string, text: string): boolean {
  const parts = name.toLowerCase().split(/\s+/).filter((p) => p.length > 1);
  const t = text.toLowerCase();
  return parts.length > 0 && parts.every((p) => t.includes(p));
}

export interface ContactResult {
  founder: string | null;
  founderSource: string | null;
  linkedinUrl: string | null;
  linkedinSource: string | null;
  email: string | null;
  emailSource: string | null;
}

const founderAnswer = z.object({
  founder: z.string().nullable(),
  evidence_url: z.string().nullable(),
});

export async function findFounder(company: string, results: SearchResult[]): Promise<{ founder: string; source: string } | null> {
  if (!geminiConfigured() || !results.length) return null;
  const body = results.map((r, i) => `<source id="${i + 1}" url="${escapeForTag(r.url)}">${escapeForTag(`${r.title}\n${r.snippet}`)}</source>`).join("\n");
  try {
    const a = await geminiJson({
      system: `You read search results and name the founder or CEO of a company. ${UNTRUSTED_NOTICE} Use only the text given. If no result names a founder or CEO of this exact company, return null for both fields. Never guess.`,
      prompt: `Company: ${company}\n\n${body}\n\nWho founded or leads ${company}? Give the full name exactly as written and the url of the source that says so.`,
      jsonSchema: { type: "object", properties: { founder: { type: ["string", "null"] }, evidence_url: { type: ["string", "null"] } }, required: ["founder", "evidence_url"] },
      schema: founderAnswer,
      maxOutputTokens: 300,
    });
    if (!a.founder || !a.evidence_url) return null;
    const hit = results.find((r) => r.url === a.evidence_url);
    // The name must literally appear in that result, or we do not use it.
    if (!hit || !nameAppears(a.founder, `${hit.title} ${hit.snippet}`)) return null;
    return { founder: a.founder.trim(), source: hit.url };
  } catch {
    return null;
  }
}

export async function findLinkedIn(founder: string, company: string, ctx: SearchCtx): Promise<{ url: string; source: string } | null> {
  if (!ctx.linkedinEnabled) return null;
  const out = await search(`${founder} ${company} LinkedIn`, { limit: 6, includeDomains: ["linkedin.com"] }, { chain: ctx.chain, settings: ctx.settings, budget: ctx.budget });
  const firstWord = company.split(/\s+/)[0].toLowerCase();
  for (const r of out.results) {
    if (!isLinkedInProfile(r.url)) continue;
    const text = `${r.title} ${r.snippet}`;
    if (nameAppears(founder, text) && text.toLowerCase().includes(firstWord)) return { url: r.url, source: r.url };
  }
  return null;
}

export async function findEmail(domain: string): Promise<{ email: string; source: string } | null> {
  for (const path of ["", "/contact", "/contact-us", "/about"]) {
    const url = `https://${domain.replace(/^https?:\/\//, "")}${path}`;
    try {
      const { text, finalUrl } = await getText(url, { timeoutMs: 6000, maxBytes: 600_000 });
      const emails = extractEmails(text, domain);
      if (emails.length) return { email: emails[0], source: finalUrl };
    } catch {
      /* try the next page */
    }
  }
  return null;
}

export interface SearchCtx {
  chain: SearchChain;
  settings: DigestSettings;
  budget: SearchBudget;
  linkedinEnabled: boolean;
}

export async function findContact(p: { company: string; domain: string | null; knownFounder: { name: string; source: string } | null; ctx: SearchCtx }): Promise<ContactResult> {
  const r: ContactResult = { founder: null, founderSource: null, linkedinUrl: null, linkedinSource: null, email: null, emailSource: null };
  if (p.knownFounder) {
    r.founder = p.knownFounder.name;
    r.founderSource = p.knownFounder.source;
  } else {
    const out = await search(`${p.company} founder CEO India startup`, { limit: 6 }, { chain: p.ctx.chain, settings: p.ctx.settings, budget: p.ctx.budget });
    const f = await findFounder(p.company, out.results);
    if (f) {
      r.founder = f.founder;
      r.founderSource = f.source;
    }
  }
  if (r.founder) {
    const li = await findLinkedIn(r.founder, p.company, p.ctx);
    if (li) {
      r.linkedinUrl = li.url;
      r.linkedinSource = li.source;
    }
  }
  if (p.domain) {
    const e = await findEmail(p.domain);
    if (e) {
      r.email = e.email;
      r.emailSource = e.source;
    }
  }
  return r;
}
