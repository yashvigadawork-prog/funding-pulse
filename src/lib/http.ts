/** Small fetch helpers: timeouts, size caps and a polite user agent. */
export const USER_AGENT = "FundingPulseBot/1.0 (+venture scouting digest; respects robots and rate limits)";

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Reads at most `maxBytes` of the body as text, so a huge page cannot exhaust memory. */
export async function readTextCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
  const buf = new Uint8Array(Math.min(total, maxBytes));
  let off = 0;
  for (const c of chunks) {
    const slice = c.subarray(0, Math.min(c.byteLength, buf.byteLength - off));
    buf.set(slice, off);
    off += slice.byteLength;
    if (off >= buf.byteLength) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

export async function getText(url: string, opts: { timeoutMs?: number; maxBytes?: number; accept?: string } = {}) {
  const res = await fetchWithTimeout(
    url,
    { headers: { "user-agent": USER_AGENT, accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml,application/rss+xml;q=0.9,*/*;q=0.5" }, redirect: "follow" },
    opts.timeoutMs ?? 8000,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await readTextCapped(res, opts.maxBytes ?? 1_500_000);
  return { text, finalUrl: res.url, contentType: res.headers.get("content-type") ?? "" };
}

/** Removes tracking parameters and fragments so the same article is stored once. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(k)) u.searchParams.delete(k);
    u.hostname = u.hostname.toLowerCase();
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
