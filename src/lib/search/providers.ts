import { geminiGenerate } from "@/lib/gemini";
import { domainOf, fetchWithTimeout } from "@/lib/http";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  date: string | null;
}

export interface SearchOpts {
  limit?: number;
  /** Only results from the last N days, when the provider supports it. */
  days?: number;
  /** Keep only results from these domains (for example linkedin.com). */
  includeDomains?: string[];
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

async function json(url: string, init: RequestInit, timeoutMs = 12_000): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchWithTimeout(url, init, timeoutMs);
  } catch (e) {
    throw new ProviderError(e instanceof Error && e.name === "AbortError" ? "timed out" : "network error");
  }
  if (!res.ok) throw new ProviderError(`HTTP ${res.status}`, res.status);
  try {
    return await res.json();
  } catch {
    throw new ProviderError("bad response");
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const dateOrNull = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

type Provider = (query: string, opts: SearchOpts) => Promise<SearchResult[]>;

const tavily: Provider = async (query, opts) => {
  const data = (await json("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify({
      query,
      max_results: opts.limit ?? 8,
      topic: opts.days ? "news" : "general",
      ...(opts.days ? { days: opts.days } : {}),
      ...(opts.includeDomains?.length ? { include_domains: opts.includeDomains } : {}),
      include_answer: false,
    }),
  })) as { results?: Record<string, unknown>[] };
  return (data.results ?? []).map((r) => ({ title: str(r.title), url: str(r.url), snippet: str(r.content).slice(0, 400), date: dateOrNull(r.published_date) }));
};

const exa: Provider = async (query, opts) => {
  const data = (await json("https://api.exa.ai/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.EXA_API_KEY ?? "" },
    body: JSON.stringify({
      query,
      numResults: opts.limit ?? 8,
      type: "auto",
      ...(opts.includeDomains?.length ? { includeDomains: opts.includeDomains } : {}),
      ...(opts.days ? { startPublishedDate: new Date(Date.now() - opts.days * 86_400_000).toISOString() } : {}),
      contents: { text: { maxCharacters: 500 } },
    }),
  })) as { results?: Record<string, unknown>[] };
  return (data.results ?? []).map((r) => ({ title: str(r.title), url: str(r.url), snippet: str(r.text).slice(0, 400), date: dateOrNull(r.publishedDate) }));
};

const googlePse: Provider = async (query, opts) => {
  const u = new URL("https://www.googleapis.com/customsearch/v1");
  u.searchParams.set("key", process.env.GOOGLE_PSE_API_KEY ?? "");
  u.searchParams.set("cx", process.env.GOOGLE_PSE_CX ?? "");
  u.searchParams.set("q", query);
  u.searchParams.set("num", String(Math.min(10, opts.limit ?? 8)));
  if (opts.days) u.searchParams.set("dateRestrict", `d${opts.days}`);
  if (opts.includeDomains?.length === 1) u.searchParams.set("siteSearch", opts.includeDomains[0]);
  const data = (await json(u.toString(), {})) as { items?: Record<string, unknown>[] };
  return (data.items ?? []).map((r) => {
    const meta = ((r.pagemap as { metatags?: Record<string, unknown>[] } | undefined)?.metatags ?? [])[0] ?? {};
    return {
      title: str(r.title),
      url: str(r.link),
      snippet: str(r.snippet),
      date: dateOrNull(meta["article:published_time"] ?? meta["og:updated_time"]),
    };
  });
};

const serper: Provider = async (query, opts) => {
  const q = opts.includeDomains?.length === 1 ? `${query} site:${opts.includeDomains[0]}` : query;
  const endpoint = opts.days ? "https://google.serper.dev/news" : "https://google.serper.dev/search";
  const data = (await json(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.SERPER_API_KEY ?? "" },
    body: JSON.stringify({ q, num: opts.limit ?? 8, gl: "in", ...(opts.days ? { tbs: opts.days <= 1 ? "qdr:d" : opts.days <= 7 ? "qdr:w" : "qdr:m" } : {}) }),
  })) as { organic?: Record<string, unknown>[]; news?: Record<string, unknown>[] };
  return [...(data.news ?? []), ...(data.organic ?? [])].map((r) => ({
    title: str(r.title),
    url: str(r.link),
    snippet: str(r.snippet),
    date: dateOrNull(r.date),
  }));
};

/** Last resort: Gemini with Google Search grounding. Uses the Gemini quota. */
const geminiGrounding: Provider = async (query, opts) => {
  const scope = opts.includeDomains?.length ? ` (only from ${opts.includeDomains.join(", ")})` : "";
  const { text, raw } = await geminiGenerate({
    prompt: `Search the web for: ${query}${scope}. Give a brief factual summary of what recent pages say. Do not invent anything.`,
    tools: [{ google_search: {} }],
    maxOutputTokens: 1024,
    maxAttempts: 2,
  });
  const g = raw.candidates?.[0]?.groundingMetadata;
  const chunks = g?.groundingChunks ?? [];
  const out: SearchResult[] = [];
  for (let i = 0; i < chunks.length && out.length < (opts.limit ?? 8); i++) {
    const web = chunks[i].web;
    if (!web?.uri) continue;
    let url = web.uri;
    // Grounding links are redirects through a Google address; follow once to get the real page.
    if (/vertexaisearch\.cloud\.google\.com|grounding-api-redirect/.test(url)) {
      try {
        const r = await fetchWithTimeout(url, { method: "GET", redirect: "manual" }, 6000);
        const loc = r.headers.get("location");
        if (loc) url = loc;
      } catch {
        /* keep the redirect link */
      }
    }
    const support = (g?.groundingSupports ?? []).filter((s) => s.groundingChunkIndices?.includes(i)).map((s) => s.segment?.text ?? "").join(" ");
    out.push({ title: web.title || domainOf(url), url, snippet: (support || text).slice(0, 400), date: null });
  }
  return out;
};

export const PROVIDERS: Record<string, Provider> = {
  tavily,
  exa,
  google_programmable_search: googlePse,
  serper,
  gemini_grounding: geminiGrounding,
};
