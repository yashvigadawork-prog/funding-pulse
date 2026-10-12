"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Banner, EmptyState } from "@/components/common/states";
import { CompanyLogo, NativeSelect, SectorDot, TagBadge } from "@/components/common/ui-bits";
import { useConfig } from "@/lib/client/api";
import { formatInr, formatUsd } from "@/lib/money";
import { plural } from "@/lib/format";
import { Amount, SourceLinks } from "./deal-bits";
import { CapitalChart, MomentumChart, NewInvestorChart } from "./charts";
import type { AnalysisBlock } from "@/lib/pipeline/analyse";
import type { DealRowView, DigestView } from "@/lib/view-types";

function H({ id, children, hint }: { id?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 id={id} className="text-base font-semibold tracking-tight">
        {children}
      </h3>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* ---------------- highlights ---------------- */

function Highlights({ view, onOpenDeal }: { view: DigestView; onOpenDeal: (d: DealRowView) => void }) {
  const { data: cfg } = useConfig();
  const top = cfg?.digest_settings.highlights_top ?? 5;
  const total = cfg?.digest_settings.highlights_total ?? 15;
  const [all, setAll] = useState(false);
  const list = view.digest!.highlights;
  const shown = list.slice(0, all ? total : top);
  const byId = new Map(view.deals.map((d) => [d.id, d]));
  if (!list.length) return null;
  return (
    <div>
      <H hint="Ranked by fit with the mandate, size, watchlist involvement, new-investor entry and novelty.">Top {Math.min(top, list.length)} highlights</H>
      <ol className="grid gap-2">
        {shown.map((h, i) => {
          const deal = byId.get(h.dealId);
          return (
            <li key={h.dealId} className="fp-fade-in flex gap-3 rounded-xl border bg-card p-3" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{h.rank}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <CompanyLogo name={h.companyName} domain={deal?.domain} size={22} />
                  <button type="button" disabled={!deal} onClick={() => deal && onOpenDeal(deal)} className="text-sm font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded">
                    {h.companyName}
                  </button>
                  {h.matchTag ? <TagBadge tag={h.matchTag} /> : null}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <SectorDot sector={h.sector} /> {h.sector} · {h.stage ?? "Unknown"} · {h.amountUsd !== null ? `${formatInr(h.amountInr)} (${formatUsd(h.amountUsd)})` : "Undisclosed"}
                  </span>
                </div>
                <p className="mt-1 text-sm">{h.why}</p>
                <SourceLinks sources={h.sources} className="mt-2" max={4} />
              </div>
            </li>
          );
        })}
      </ol>
      {list.length > top ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setAll((a) => !a)} aria-expanded={all}>
          {all ? "Show fewer" : `Show ${Math.min(total, list.length) - top} more`}
        </Button>
      ) : null}
    </div>
  );
}

/* ---------------- pattern panels ---------------- */

function Points({ block }: { block: AnalysisBlock }) {
  if (!block.points.length) return <p className="text-sm text-muted-foreground">No cited points this week.</p>;
  return (
    <ul className="grid gap-3">
      {block.points.map((p, i) => (
        <li key={i} className="text-sm">
          <span
            className={`mr-2 inline-block rounded px-1.5 py-0.5 align-middle text-[0.68rem] font-semibold ${p.label === "Reported" ? "bg-positive/15 text-positive" : "bg-warning/15 text-warning"}`}
            title={p.label === "Reported" ? "A source says this" : "An inference, not stated in a source"}
          >
            {p.label}
          </span>
          {p.text}
          <SourceLinks sources={p.sources} className="mt-1.5" />
        </li>
      ))}
    </ul>
  );
}

function Panel({ id, title, summary, chart, block, children }: { id: string; title: string; summary: string; chart: React.ReactNode; block: AnalysisBlock; children?: React.ReactNode }) {
  return (
    <article id={id} className="scroll-mt-28 rounded-xl border bg-card p-4 md:p-5">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="mt-1 text-sm">{summary}</p>
      <div className="mt-3">{chart}</div>
      {children}
      <div className="mt-3 border-t pt-3">
        <Points block={block} />
      </div>
    </article>
  );
}

const STATUS_TEXT: Record<string, string> = { accelerating: "Speeding up", slowing: "Slowing", steady: "Steady", not_enough_history: "Not enough history" };

function Patterns({ view }: { view: DigestView }) {
  const d = view.digest!;
  const c = d.patterns.computed;
  const a = d.analysis;
  return (
    <div>
      <H hint="Each panel shows the computed numbers, then a short explanation. Reported means a source says it; Possible means it is an inference.">The three questions</H>
      {a.source === "template" ? (
        <div className="mb-3">
          {a.reason === "ai_unavailable" ? (
            <Banner tone="warn" title="Written from a template">
              Written from a template because the AI service was unavailable. The numbers are unaffected.
            </Banner>
          ) : (
            <Banner tone="info" title="Plain summary for this week">
              This week was loaded from earlier data, so the text is a plain summary written from the numbers. The latest digest has the full AI explanation.
            </Banner>
          )}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel id="pattern-capital" title="Which sectors are attracting capital?" summary={a.capital.summary} chart={<CapitalChart capital={c.capital} />} block={a.capital}>
          <p className="mt-2 text-xs text-muted-foreground">Bars show disclosed amounts only. Light bars are each sector&rsquo;s usual weekly amount.</p>
          {c.capital.some((x) => x.undisclosed.length) ? (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-muted-foreground">Deals with an undisclosed amount ({c.kpis.undisclosedCount}), not counted above</summary>
              <ul className="mt-1 grid gap-0.5 pl-4">
                {c.capital.flatMap((x) => x.undisclosed.map((u) => <li key={u.id}>{u.companyName} <span className="text-muted-foreground">({x.sector})</span></li>))}
              </ul>
            </details>
          ) : null}
        </Panel>
        <Panel id="pattern-momentum" title="Is activity speeding up or slowing in your spaces?" summary={a.momentum.summary} chart={<MomentumChart trends={c.trends} />} block={a.momentum}>
          <ul className="mt-2 grid gap-1 text-xs">
            {c.trends
              .filter((t) => t.isFocus)
              .map((t) => (
                <li key={t.sector} className="flex justify-between gap-2">
                  <span>{t.sector}</span>
                  <span className={t.status === "accelerating" ? "font-medium text-positive" : t.status === "slowing" ? "font-medium text-warning" : "text-muted-foreground"}>
                    {STATUS_TEXT[t.status]} ({t.thisWeek} vs {Math.round(t.baselineAvg * 10) / 10})
                  </span>
                </li>
              ))}
          </ul>
          {c.otherSectorsToNote.length ? (
            <div className="mt-2 rounded-lg bg-muted/60 p-2 text-xs">
              <p className="font-medium">Other sectors to note</p>
              <ul className="mt-1 grid gap-0.5">
                {c.otherSectorsToNote.map((t) => (
                  <li key={t.sector}>
                    {t.sector}: {STATUS_TEXT[t.status].toLowerCase()} ({t.thisWeek} vs {Math.round(t.baselineAvg * 10) / 10})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
        <Panel id="pattern-new_investors" title="Has a new investor started moving in our target sectors?" summary={a.new_investors.summary} chart={<NewInvestorChart entries={c.newInvestors} />} block={a.new_investors}>
          {c.newInvestors.length ? (
            <ul className="mt-2 grid gap-1 text-xs">
              {c.newInvestors.slice(0, 10).map((n) => (
                <li key={`${n.sector}-${n.investor}`}>
                  <span className="font-medium">{n.investor}</span> <span className="text-muted-foreground">in {n.sector}{n.onWatchlist ? " · investor of interest" : ""}</span>
                </li>
              ))}
              {c.newInvestors.length > 10 ? <li className="text-muted-foreground">+{c.newInvestors.length - 10} more (investors of interest are listed first)</li> : null}
            </ul>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">&ldquo;New&rdquo; means new in our records for that sector, not new to the market.{c.sectorsWithoutHistory.length ? ` Not enough history to check: ${c.sectorsWithoutHistory.join(", ")}.` : ""}</p>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- deal table ---------------- */

function DealRows({ deals, onOpenDeal }: { deals: DealRowView[]; onOpenDeal: (d: DealRowView) => void }) {
  return (
    <ul className="divide-y">
      {deals.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => onOpenDeal(d)}
            className="grid w-full grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 px-2 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[auto_minmax(0,1.4fr)_8rem_minmax(0,1.2fr)_minmax(0,1.4fr)_6rem]"
          >
            <CompanyLogo name={d.companyName} domain={d.domain} size={28} />
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-medium">{d.companyName}</span>
              {d.matchTag && !d.needsReview ? <TagBadge tag={d.matchTag} /> : null}
              {d.needsReview ? <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[0.68rem] text-warning">review</span> : null}
              {d.adjacentTo.length ? <span className="rounded bg-accent px-1.5 py-0.5 text-[0.68rem] text-accent-foreground">adjacent</span> : null}
            </span>
            <span className="col-start-2 text-xs text-muted-foreground md:col-start-auto md:text-sm">{d.stage ?? "Unknown"}</span>
            <span className="col-start-2 text-sm md:col-start-auto">
              <Amount deal={d} withText={false} />
            </span>
            <span className="col-start-2 truncate text-xs text-muted-foreground md:col-start-auto">
              {d.investors.length ? d.investors.slice(0, 3).map((i) => i.name).join(", ") : "Investors not reported"}
            </span>
            <span className="col-start-2 text-xs text-muted-foreground md:col-start-auto md:text-right">{d.announcedOn ?? ""}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DealTable({ view, onOpenDeal }: { view: DigestView; onOpenDeal: (d: DealRowView) => void }) {
  const { data: cfg } = useConfig();
  const focusSectors = useMemo(() => new Set(cfg?.mandate.focus_sectors ?? []), [cfg]);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
  const [stage, setStage] = useState("all");
  const [tag, setTag] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const stages = Array.from(new Set(view.deals.map((d) => d.stage ?? "Unknown")));
  const sectors = Array.from(new Set(view.deals.map((d) => d.sector)));
  const filtered = view.deals.filter(
    (d) =>
      (sector === "all" || d.sector === sector) &&
      (stage === "all" || (d.stage ?? "Unknown") === stage) &&
      (tag === "all" || (tag === "watch" ? !!d.matchTag : d.matchTag === tag)) &&
      (!q.trim() || d.companyName.toLowerCase().includes(q.trim().toLowerCase()) || d.investors.some((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()))),
  );
  const groups = sectors
    .map((s) => ({ sector: s, rows: filtered.filter((d) => d.sector === s), focus: focusSectors.has(s) }))
    .filter((g) => g.rows.length)
    .sort((a, b) => Number(b.focus) - Number(a.focus) || b.rows.length - a.rows.length);

  return (
    <div id="all-deals" className="scroll-mt-28">
      <H hint="Grouped by sector. Focus sectors are open; others are collapsed. Select a row for details and every source link.">All deals this week ({view.deals.length})</H>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input aria-label="Search company or investor" placeholder="Search company or investor" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <NativeSelect ariaLabel="Filter by sector" value={sector} onChange={setSector} options={[{ value: "all", label: "All sectors" }, ...sectors.map((s) => ({ value: s, label: s }))]} />
        <NativeSelect ariaLabel="Filter by stage" value={stage} onChange={setStage} options={[{ value: "all", label: "All stages" }, ...stages.map((s) => ({ value: s, label: s }))]} />
        <NativeSelect
          ariaLabel="Filter by watchlist"
          value={tag}
          onChange={setTag}
          options={[
            { value: "all", label: "All companies" },
            { value: "watch", label: "Watchlist only" },
            { value: "Portfolio", label: "Portfolio" },
            { value: "On Radar", label: "On Radar" },
          ]}
        />
        <Button variant="outline" size="sm" className="h-8" onClick={() => setShowAll((s) => !s)} aria-pressed={showAll}>
          {showAll ? "Collapse others" : "Show all sectors"}
        </Button>
      </div>
      {!groups.length ? (
        <EmptyState title="No deals match these filters">Clear a filter to see more.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {groups.map((g) => {
            const isOpen = open[g.sector] ?? (g.focus || showAll);
            const disclosed = g.rows.reduce((a, r) => a + (r.amountUsd ?? 0), 0);
            return (
              <div key={g.sector} className="rounded-xl border bg-card">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen((o) => ({ ...o, [g.sector]: !isOpen }))}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                >
                  {isOpen ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                  <SectorDot sector={g.sector} />
                  <span className="text-sm font-semibold">{g.sector}</span>
                  {g.focus ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[0.68rem] text-primary">focus</span> : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {plural(g.rows.length, "deal")}
                    {disclosed ? ` · ${formatUsd(disclosed)} disclosed` : ""}
                  </span>
                </button>
                {isOpen ? <DealRows deals={g.rows} onOpenDeal={onOpenDeal} /> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- needs review ---------------- */

function NeedsReview({ view }: { view: DigestView }) {
  const items = view.digest!.patterns.needsReview ?? [];
  return (
    <div id="needs-review" className="scroll-mt-28">
      <H hint="Names that nearly equal a company on your lists but were not an exact match. The app flags them instead of guessing.">Needs review ({items.length})</H>
      {items.length ? (
        <ul className="grid gap-2">
          {items.map((r) => (
            <li key={r.dealId} className="rounded-xl border bg-card p-3 text-sm">
              <p>
                <span className="font-medium">{r.asWritten}</span> <span className="text-muted-foreground">(as written in the article)</span>
              </p>
              <p className="text-muted-foreground">
                Closest company on your lists: <span className="font-medium text-foreground">{r.closestCompany ?? "unknown"}</span>
                {r.closestTag ? ` (${r.closestTag})` : ""} · similarity {r.score !== null ? r.score.toFixed(2) : "not recorded"}
              </p>
              <p className="text-xs text-muted-foreground">{r.reason}</p>
              <SourceLinks sources={r.sources} className="mt-1.5" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">None this week.</p>
      )}
    </div>
  );
}

export function Section2({ view, onOpenDeal }: { view: DigestView; onOpenDeal: (d: DealRowView) => void }) {
  return (
    <section aria-labelledby="s2" className="grid gap-8">
      <h2 id="s2" className="text-xl font-semibold tracking-tight">
        Market overview
      </h2>
      <Highlights view={view} onOpenDeal={onOpenDeal} />
      <Patterns view={view} />
      <DealTable view={view} onOpenDeal={onOpenDeal} />
      <NeedsReview view={view} />
    </section>
  );
}
