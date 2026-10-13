/** @jsxImportSource @/lib/deck/jsx */
import "server-only";
import { render, type Child } from "@/lib/deck/jsx/jsx-runtime";
import { firstSentence, weekBullets, weekHeadline } from "@/components/brief/derive";
import { stageLabel } from "@/lib/format";
import { amountLabel, formatInr, formatUsd } from "@/lib/money";
import { formatWeekRange } from "@/lib/time";
import type { DealRowView, DigestView } from "@/lib/view-types";
import type { DeckSectionId } from "./sections";
import { deckCss } from "./styles";

type Digest = NonNullable<DigestView["digest"]>;

const SECTOR_HEX: Record<string, string> = {
  Fintech: "#3B6BF5",
  "Health & wellness": "#E8772E",
  "Climate & sustainability": "#14A07A",
  "Media, deeptech & education": "#8B4FE0",
  Other: "#9096A3",
};
const hex = (s: string) => SECTOR_HEX[s] ?? "#9096A3";
const shortSector = (s: string) => ({ "Health & wellness": "Health", "Climate & sustainability": "Climate", "Media, deeptech & education": "Deeptech & media" })[s as string] ?? s;
const STATUS = { accelerating: ["Speeding up", "up"], slowing: ["Slowing", "down"], steady: ["Steady", "flat"], not_enough_history: ["Not enough history", "flat"] } as const;
/** Keeps the fund's internal list names out of an LP-facing deck. */
const lp = (t: string) =>
  t
    .replace(/watchlist investors/gi, "investors we watch")
    .replace(/\bwatchlist\b/gi, "watch list")
    .replace(/\bOn Radar\b/g, "followed")
    .replace(/\bPortfolio (company|companies)\b/gi, (_, w) => (w.toLowerCase() === "company" ? "company we back" : "companies we back"))
    .replace(/\bPortfolio\b/g, "backed");
const short = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
const fig = (n: number) => (Math.round(n * 10) / 10).toString();
const tagChip = (t: DealRowView["matchTag"] | string | null) => (t === "Portfolio" ? <span className="chip back">We back</span> : t === "On Radar" ? <span className="chip follow">We follow</span> : null);

interface Slide {
  key: string;
  kicker: string;
  title: Child;
  lede?: string;
  body: Child;
}

/* ---------------- sections ---------------- */

function glance(view: DigestView, d: Digest): Slide {
  const k = d.kpis;
  const c = d.patterns.computed;
  const delta = typeof k.prevDeals === "number" ? k.deals - k.prevDeals : null;
  const interest = new Set(c.newInvestors.filter((n) => n.onWatchlist).map((n) => n.investor.toLowerCase())).size;
  const topDeals = c.capital.find((x) => x.sector === k.topSector)?.deals;
  const direct = k.directHits ?? k.watchlistHits;
  const hist = view.history;
  const max = Math.max(1, ...hist.map((h) => h.deals));
  const W = 560;
  const H = 120;
  const step = hist.length > 1 ? W / (hist.length - 1) : W;
  const pts = hist.map((h, i) => [i * step, H - 14 - (h.deals / max) * (H - 34)] as const);
  return {
    key: "glance",
    kicker: "The week at a glance",
    title: lp(weekHeadline(view)),
    body: (
      <div className="cols" style={{ gridTemplateColumns: "1fr 1.15fr" }}>
        <div>
          <ul className="bul">
            {weekBullets(view).map((b, i) => (
              <li key={i}>{lp(b)}</li>
            ))}
          </ul>
          <div className="card" style={{ marginTop: 30, padding: "14px 18px" }}>
            <div className="mut" style={{ fontSize: 13, fontWeight: 600 }}>Deals per week, last {hist.length} weeks</div>
            <svg width={W} height={H} viewBox={`0 0 ${W + 16} ${H}`} style={{ marginTop: 6 }}>
              <polyline points={pts.map((p) => `${p[0] + 8},${p[1]}`).join(" ")} fill="none" stroke="#3B4BDB" strokeWidth="3" strokeLinejoin="round" />
              {pts.map((p, i) => (
                <g key={i}>
                  <circle cx={p[0] + 8} cy={p[1]} r={i === pts.length - 1 ? 6 : 3.5} fill={i === pts.length - 1 ? "#3B4BDB" : "#fff"} stroke="#3B4BDB" strokeWidth="2.5" />
                  {i === pts.length - 1 || i === 0 ? <text x={p[0] + 8} y={p[1] - 12} textAnchor={i === 0 ? "start" : "end"} fontSize="14" fontWeight="600" fill="#23273A">{hist[i].deals}</text> : null}
                </g>
              ))}
            </svg>
          </div>
        </div>
        <div className="tiles" style={{ alignContent: "start" }}>
          <div className="tile">
            <div className="lab">Deals</div>
            <div><div className="val">{k.deals}</div>{delta !== null ? <div className="sub">{delta >= 0 ? "+" : ""}{delta} vs the week before</div> : null}</div>
          </div>
          <div className="tile" style={{ gridColumn: "span 2" }}>
            <div className="lab">Capital disclosed</div>
            <div><div className="val">{formatInr(k.disclosedInr)}</div><div className="sub">{formatUsd(k.disclosedUsd)}{k.undisclosedCount ? ` · ${k.undisclosedCount} deals did not disclose an amount and are not counted` : ""}</div></div>
          </div>
          <div className="tile" style={{ gridColumn: "span 2" }}>
            <div className="lab">Top sector</div>
            <div><div className="val sm">{k.topSector ?? "None"}</div>{k.topSectorUsd ? <div className="sub">{formatUsd(k.topSectorUsd)} · {topDeals} deals</div> : null}</div>
          </div>
          <div className="tile">
            <div className="lab">Our companies in the news</div>
            <div><div className="val">{direct}</div>{k.adjacentHits ? <div className="sub">+{k.adjacentHits} nearby raises</div> : null}</div>
          </div>
          <div className="tile">
            <div className="lab">New investors</div>
            <div><div className="val">{k.newInvestors}</div><div className="sub">{interest} we watch</div></div>
          </div>
          <div className="tile">
            <div className="lab">In our focus</div>
            <div><div className="val">{c.focusDealIds.length}</div><div className="sub">fit sector and stage</div></div>
          </div>
        </div>
      </div>
    ),
  };
}

function money(d: Digest): Slide {
  const a = d.analysis.capital;
  const rows = d.patterns.computed.capital.filter((x) => x.deals > 0).sort((x, y) => y.disclosedUsd - x.disclosedUsd || y.deals - x.deals);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.disclosedUsd, r.baselineAvgUsd)));
  const bullets = (a.bullets ?? []).map((b) => lp(b.text)).slice(0, 3);
  return {
    key: "money",
    kicker: "Where the money went",
    title: lp(a.headline ?? firstSentence(a.summary, 130)),
    body: (
      <div className="cols" style={{ gridTemplateColumns: bullets.length ? "1.7fr 1fr" : "1fr" }}>
        <div className="bars">
          {rows.map((r) => (
            <div className="row" key={r.sector}>
              <div className="name"><span className="dot" style={{ background: hex(r.sector) }} />{shortSector(r.sector)}</div>
              <div className="track">
                <div className="fill" style={{ width: `${(r.disclosedUsd / max) * 100}%`, background: hex(r.sector) }} />
                {r.baselineAvgUsd > 0 ? <div className="tick" style={{ left: `${(r.baselineAvgUsd / max) * 100}%` }} /> : null}
              </div>
              <div className="num">{r.disclosedUsd > 0 ? formatUsd(r.disclosedUsd) : "None disclosed"}<small>{r.deals} {r.deals === 1 ? "deal" : "deals"}</small></div>
            </div>
          ))}
          <div className="note">{`The black tick marks each sector's usual week. ${d.kpis.undisclosedCount} deals did not disclose an amount and are not counted.`}</div>
        </div>
        {bullets.length ? (
          <div>
            <ul className="bul">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </div>
        ) : null}
      </div>
    ),
  };
}

function momentum(d: Digest): Slide {
  const a = d.analysis.momentum;
  const rows = d.patterns.computed.trends.filter((t) => t.thisWeek > 0 || t.baselineTotal > 0).sort((x, y) => Number(y.isFocus) - Number(x.isFocus) || (y.ratio ?? 0) - (x.ratio ?? 0)).slice(0, 7);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.thisWeek, r.baselineAvg)));
  const bullets = (a.bullets ?? []).map((b) => lp(b.text)).slice(0, 3);
  return {
    key: "momentum",
    kicker: "Who's heating up",
    title: lp(a.headline ?? firstSentence(a.summary, 130)),
    body: (
      <div className="cols" style={{ gridTemplateColumns: bullets.length ? "2.3fr 1fr" : "1fr" }}>
        <div className="dumb">
          {rows.map((r) => {
            const [label, cls] = STATUS[r.status];
            const x1 = (r.baselineAvg / max) * 94 + 3;
            const x2 = (r.thisWeek / max) * 94 + 3;
            return (
              <div className="row" key={r.sector}>
                <div className="name" style={{ fontSize: 17, fontWeight: 600, display: "flex", gap: 10, alignItems: "center" }}><span className="dot" style={{ background: hex(r.sector) }} />{shortSector(r.sector)}</div>
                <div className="track" style={{ height: 30, background: "transparent" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "#E6E3DC" }} />
                  <div className="line" style={{ left: `${Math.min(x1, x2)}%`, width: `${Math.abs(x2 - x1)}%`, background: hex(r.sector) }} />
                  <div className="pt hollow" style={{ left: `${x1}%`, borderColor: hex(r.sector) }} />
                  <div className="pt" style={{ left: `${x2}%`, background: hex(r.sector) }} />
                </div>
                <div className="num" style={{ fontSize: 16 }}>{r.thisWeek} vs {fig(r.baselineAvg)}<small>this week vs usual</small></div>
                <div><span className={`chip ${cls}`}>{label}{r.ratio && (r.status === "accelerating" || r.status === "slowing") ? ` · ${fig(r.ratio)}×` : ""}</span></div>
              </div>
            );
          })}
          <div className="note">Hollow dot: usual weekly count (average of the last four weeks). Filled dot: this week.</div>
        </div>
        {bullets.length ? <div><ul className="bul">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul></div> : null}
      </div>
    ),
  };
}

function investors(d: Digest): Slide {
  const a = d.analysis.new_investors;
  const list = d.patterns.computed.newInvestors;
  const bySector = new Map<string, Set<string>>();
  for (const n of list) bySector.set(n.sector, (bySector.get(n.sector) ?? new Set()).add(n.investor.toLowerCase()));
  const cols = [...bySector.entries()].map(([s, set]) => ({ s, n: set.size })).sort((x, y) => y.n - x.n);
  const max = Math.max(1, ...cols.map((c) => c.n));
  const watched = [...new Set(list.filter((n) => n.onWatchlist).map((n) => n.investor))].slice(0, 10);
  const bullets = (a.bullets ?? []).map((b) => lp(b.text)).slice(0, 3);
  return {
    key: "investors",
    kicker: "New faces at the table",
    title: lp(a.headline ?? firstSentence(a.summary, 130)),
    body: (
      <div className="cols" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
        <div>
          {cols.length ? (
            <>
              <div className="cols-chart">
                {cols.map((c) => (
                  <div className="colbar" key={c.s}><b>{c.n}</b><div style={{ height: `${(c.n / max) * 82}%`, background: hex(c.s) }} /></div>
                ))}
              </div>
              <div className="collab">{cols.map((c) => <span key={c.s}>{shortSector(c.s)}</span>)}</div>
            </>
          ) : <div className="empty">No new investors in our target sectors this week.</div>}
          <div className="note" style={{ marginTop: 14 }}>{'"New" means new in our records for that sector, not new to the market.'}</div>
        </div>
        <div>
          {bullets.length ? <ul className="bul">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul> : null}
          {watched.length ? (
            <div style={{ marginTop: 26 }}>
              <div className="mut" style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" }}>Investors we watch, new this week</div>
              <div className="chips">{watched.map((w) => <span key={w}>{w}</span>)}</div>
            </div>
          ) : null}
        </div>
      </div>
    ),
  };
}

function sourceLine(sources: { url: string; outlet: string | null }[]) {
  const seen = new Set<string>();
  const out = sources.filter((s) => (seen.has(s.outlet ?? s.url) ? false : (seen.add(s.outlet ?? s.url), true))).slice(0, 3);
  return out.length ? <div className="src">{out.map((s, i) => <span key={s.url}>{i ? " · " : "Source: "}<a href={s.url}>{s.outlet ?? new URL(s.url).hostname.replace(/^www\./, "")}</a></span>)}</div> : null;
}

function fit(view: DigestView, d: Digest): Slide {
  const top = [...d.highlights].sort((a, b) => a.rank - b.rank).slice(0, 5);
  const byId = new Map(view.deals.map((x) => [x.id, x]));
  return {
    key: "fit",
    kicker: "Deals that fit the mandate",
    title: "The five deals worth a closer look",
    body: (
      <div className="fit">
        {top.map((h, i) => {
          const deal = byId.get(h.dealId);
          const lead = deal?.investors.filter((x) => x.role === "lead").map((x) => x.name).slice(0, 2).join(", ");
          return (
            <div className="item" key={h.dealId}>
              <div className="rank">{i + 1}</div>
              <div>
                <div className="co">{h.companyName}{tagChip(h.matchTag)}</div>
                <div className="meta">{shortSector(h.sector)} · {stageLabel(h.stage)}{lead ? ` · Led by ${lead}` : ""}</div>
                {deal?.summary ? <div className="desc">{short(firstSentence(deal.summary, 118), 118)}</div> : null}
                {sourceLine(h.sources)}
              </div>
              <div className="amt">{h.amountUsd !== null ? formatUsd(h.amountUsd) : "Undisclosed"}{h.amountUsd !== null ? <small>{formatInr(h.amountInr)}</small> : null}</div>
            </div>
          );
        })}
        {!top.length ? <div className="empty">No highlights this week.</div> : null}
      </div>
    ),
  };
}

function names(view: DigestView): Slide {
  const hits = view.deals.filter((x) => x.matchTag && !x.needsReview);
  const show = hits.slice(0, 7);
  return {
    key: "names",
    kicker: "Our companies in the news",
    title: hits.length ? `${hits.length} of the companies we back or follow were named this week` : "None of our companies were named this week",
    body: hits.length ? (
      <table className="t">
        <thead><tr><th>Company</th><th>Sector</th><th>Stage</th><th className="r">Amount</th><th>Who invested</th></tr></thead>
        <tbody>
          {show.map((x) => (
            <tr key={x.id}>
              <td><b style={{ fontSize: 17 }}>{x.companyName}</b> {tagChip(x.matchTag)}</td>
              <td><span className="dot" style={{ background: hex(x.sector), marginRight: 8 }} />{shortSector(x.sector)}</td>
              <td>{stageLabel(x.stage)}</td>
              <td className="r">{amountLabel(x)}</td>
              <td className="mut">{short(x.investors.map((i) => i.name).slice(0, 3).join(", ") || "Not named", 60)}</td>
            </tr>
          ))}
        </tbody>
        {hits.length > show.length ? <tfoot><tr><td colSpan={5} className="mut" style={{ paddingTop: 12 }}>and {hits.length - show.length} more in the full list</td></tr></tfoot> : null}
      </table>
    ) : <div className="empty">Nothing from our lists was reported as raising money this week.</div>,
  };
}

function nearby(d: Digest): Slide {
  const groups = (d.patterns.adjacency ?? []).slice(0, 4);
  const total = d.patterns.adjacency?.length ?? 0;
  return {
    key: "nearby",
    kicker: "Closer to home",
    title: groups.length ? "Raises close to companies we back" : "Nothing close to our companies this week",
    lede: groups.length ? "Companies working in the same space as one of ours, raising within a few days of each other." : undefined,
    body: groups.length ? (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {groups.map((g) => (
          <div className="card" key={g.portfolioId} style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 600 }}>Near {g.portfolioName}</div>
              {g.cluster ? <span className="chip up">{g.companies} raised within {g.windowDays} days</span> : <span className="chip flat">One raise</span>}
            </div>
            <div className="mut" style={{ fontSize: 14, margin: "4px 0 10px" }}>{shortSector(g.sector)}</div>
            {g.items.slice(0, 3).map((i) => (
              <div key={i.dealId} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 16, padding: "6px 0", borderTop: "1px solid #EDEBE5" }}>
                <span><b>{i.companyName}</b> <span className="mut">· {stageLabel(i.stage)}</span></span>
                <span>{amountLabel(i)}</span>
              </div>
            ))}
          </div>
        ))}
        {total > groups.length ? <div className="mut" style={{ gridColumn: "span 2", fontSize: 14 }}>and {total - groups.length} more groups in the full brief</div> : null}
      </div>
    ) : <div className="empty">No company in the same space as one we back raised this week.</div>,
  };
}

const ROWS_PER_SLIDE = 11;
function dealPages(view: DigestView): Slide[] {
  const rows = view.deals;
  const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_SLIDE));
  return Array.from({ length: pages }, (_, p) => ({
    key: `deals-${p}`,
    kicker: pages > 1 ? `Every deal this week · ${p + 1} of ${pages}` : "Every deal this week",
    title: p === 0 ? `${rows.length} deals, largest first` : "Every deal, continued",
    body: (
      <table className="t">
        <thead><tr><th>Company</th><th>Sector</th><th>Stage</th><th className="r">Amount</th><th>Led by</th><th>Date</th></tr></thead>
        <tbody>
          {rows.slice(p * ROWS_PER_SLIDE, (p + 1) * ROWS_PER_SLIDE).map((x) => (
            <tr key={x.id}>
              <td><b>{x.companyName}</b> {tagChip(x.matchTag)}</td>
              <td><span className="dot" style={{ background: hex(x.sector), marginRight: 8 }} />{shortSector(x.sector)}</td>
              <td>{stageLabel(x.stage)}</td>
              <td className="r">{amountLabel(x)}</td>
              <td className="mut">{short(x.investors.filter((i) => i.role === "lead").map((i) => i.name).join(", ") || x.investors.map((i) => i.name).slice(0, 2).join(", ") || "Not named", 40)}</td>
              <td className="mut">{x.announcedOn ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  }));
}

function review(d: Digest): Slide {
  const items = d.patterns.needsReview ?? [];
  return {
    key: "review",
    kicker: "Names to double-check",
    title: items.length ? "Close name matches that were not counted" : "No close name matches this week",
    lede: items.length ? "These company names nearly equal one of ours but are not an exact match, so they are flagged instead of guessed." : undefined,
    body: items.length ? (
      <table className="t">
        <thead><tr><th>As written in the article</th><th>Closest company on our lists</th><th className="r">Similarity</th></tr></thead>
        <tbody>
          {items.slice(0, 8).map((x) => (
            <tr key={x.dealId}><td><b>{x.asWritten}</b></td><td>{x.closestCompany ?? "None"} {tagChip(x.closestTag)}</td><td className="r">{x.score !== null ? `${Math.round(x.score * 100)}%` : ""}</td></tr>
          ))}
        </tbody>
      </table>
    ) : <div className="empty">Every company name matched exactly, or did not resemble one of ours.</div>,
  };
}

/* ---------------- the deck ---------------- */

function buildSlides(view: DigestView, sections: DeckSectionId[]): Slide[] {
  const d = view.digest!;
  const want = new Set(sections);
  const out: Slide[] = [];
  if (want.has("glance")) out.push(glance(view, d));
  if (want.has("money")) out.push(money(d));
  if (want.has("momentum")) out.push(momentum(d));
  if (want.has("investors")) out.push(investors(d));
  if (want.has("fit")) out.push(fit(view, d));
  if (want.has("names")) out.push(names(view));
  if (want.has("nearby")) out.push(nearby(d));
  if (want.has("deals")) out.push(...dealPages(view));
  if (want.has("review")) out.push(review(d));
  return out;
}

function Deck({ view, slides }: { view: DigestView; slides: Slide[] }) {
  const d = view.digest!;
  const range = view.week ? formatWeekRange(view.week) : "";
  const total = slides.length + 1;
  return (
    <>
      <section className="slide cover">
        <div className="kicker"><i />Funding Pulse · {view.fundName}</div>
        <h1>The week in <em>Indian startup funding</em></h1>
        <div className="sub">{lp(weekHeadline(view))}</div>
        <div className="meta"><span>Week of {range}</span><span>{d.kpis.deals} deals · {formatUsd(d.kpis.disclosedUsd)} disclosed</span></div>
      </section>
      {slides.map((s, i) => (
        <section className="slide" key={s.key}>
          <div className="kicker"><i />{s.kicker}</div>
          <h2 className="title">{s.title}</h2>
          {s.lede ? <div className="lede">{s.lede}</div> : null}
          <div className="body">{s.body}</div>
          <div className="foot"><span>Funding Pulse · {view.fundName} · Week of {range}</span><span>{i + 2} / {total}</span></div>
        </section>
      ))}
    </>
  );
}

/** The whole deck as one HTML page. The same page is previewed on screen and turned into the PDF. */
export function renderDeckHtml(view: DigestView, sections: DeckSectionId[], opts: { preview?: boolean } = {}): string {
  const slides = buildSlides(view, sections);
  const body = render(<Deck view={view} slides={slides} />);
  const script = opts.preview ? `<script>(function(){function f(){document.documentElement.style.setProperty('--z',Math.min(1,(innerWidth-24)/1280))}f();addEventListener('resize',f)})()</script>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Funding Pulse summary deck</title><style>${deckCss()}</style></head><body>${body}${script}</body></html>`;
}

export const deckSlideCount = (view: DigestView, sections: DeckSectionId[]) => buildSlides(view, sections).length + 1;
