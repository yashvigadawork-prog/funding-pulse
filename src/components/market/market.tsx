"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, Flame, Landmark, Search, SearchCheck, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Banner, EmptyState } from "@/components/common/states";
import { Collapse } from "@/components/common/motion-bits";
import { CompanyLogo, NativeSelect, SECTOR_VAR } from "@/components/common/ui-bits";
import { BentoCard, Chip } from "@/components/brief/bento";
import { useConfig } from "@/lib/client/api";
import { plural, stageLabel } from "@/lib/format";
import { formatUsd } from "@/lib/money";
import { Amount, SourceChips } from "@/components/dashboard/deal-bits";
import { FacesChart, HeatChart, MoneyChart } from "@/components/dashboard/charts";
import { useNav } from "@/components/dashboard/nav";
import type { AnalysisBlock, AnalysisPoint } from "@/lib/pipeline/analyse";
import type { DealRowView, DigestView } from "@/lib/view-types";

const sectorVar = (s: string) => SECTOR_VAR[s] ?? "var(--sector-other)";
const PAGE = 12;

/* ---------------- Reported / Possible statements ---------------- */

function Statement({ p }: { p: AnalysisPoint }) {
  return (
    <li className="text-sm">
      <span className={`mr-2 inline-block rounded px-1.5 py-0.5 align-middle text-[0.68rem] font-semibold ${p.label === "Reported" ? "bg-positive-soft text-positive-ink" : "bg-warning-soft text-warning-ink"}`} title={p.label === "Reported" ? "A source says this" : "An inference, not stated in a source"}>
        {p.label}
      </span>
      {p.text}
      <SourceChips sources={p.sources} className="mt-1.5" />
    </li>
  );
}

function Statements({ list, empty }: { list: AnalysisPoint[]; empty: string }) {
  if (!list.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {list.map((p, i) => (
        <Statement key={i} p={p} />
      ))}
    </ul>
  );
}

/* ---------------- one question panel ---------------- */

const STATUS_TEXT: Record<string, string> = { accelerating: "Speeding up", slowing: "Slowing", steady: "Steady", not_enough_history: "Not enough history" };

function QuestionPanel({
  id,
  keyName,
  icon,
  tone,
  title,
  block,
  chart,
  extra,
  index,
}: {
  id: string;
  keyName: string;
  icon: typeof Landmark;
  tone: "teal" | "amber" | "primary";
  title: string;
  block: AnalysisBlock;
  chart: React.ReactNode;
  extra: React.ReactNode;
  index: number;
}) {
  const nav = useNav();
  const [st, setSt] = useState<{ for: string | null; val: boolean } | null>(null);
  const open = st && st.for === nav.expanded ? st.val : nav.expanded === keyName;
  const bullets = block.bullets ?? [];
  return (
    <BentoCard id={id} icon={icon} tone={tone} title={title} index={index}>
      <p className="text-[15px] font-medium text-foreground">{block.headline ?? block.summary}</p>
      {bullets.length ? <div className="mt-2"><Statements list={bullets} empty="" /></div> : null}
      <div className="mt-4">{chart}</div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-detail`}
        onClick={() => setSt({ for: nav.expanded, val: !open })}
        className="mt-4 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? "Hide the analysis" : "Read the analysis"}
        <ChevronDown aria-hidden className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <Collapse open={open}>
        <div id={`${id}-detail`} className="grid gap-4 border-t pt-4 mt-3">
          {block.headline ? <p className="text-sm text-ink-2">{block.summary}</p> : null}
          <Statements list={block.points} empty="No cited statements this week." />
          {extra}
        </div>
      </Collapse>
    </BentoCard>
  );
}

function QuestionPanels({ view }: { view: DigestView }) {
  const d = view.digest!;
  const c = d.patterns.computed;
  const a = d.analysis;
  const { data: cfg } = useConfig();
  const [allInv, setAllInv] = useState(false);
  const focus = cfg?.mandate.focus_sectors ?? c.trends.filter((t) => t.isFocus).map((t) => t.sector);
  const invShown = allInv ? c.newInvestors : c.newInvestors.slice(0, 10);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">The three questions</h2>
        <p className="text-sm text-muted-foreground">Each panel shows the computed numbers, then a short explanation. Reported means a source says it; Possible means it is an inference.</p>
      </div>
      {a.source === "template" ? (
        a.reason === "ai_unavailable" ? (
          <Banner tone="warn" title="Written from a template">
            Written from a template because the AI service was unavailable. The numbers are unaffected.
          </Banner>
        ) : (
          <Banner tone="info" title="Plain summary for this week">
            This week was loaded from earlier data, so the text is a plain summary written from the numbers. The latest digest has the full AI explanation.
          </Banner>
        )
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        <QuestionPanel
          id="pattern-capital"
          keyName="capital"
          icon={Landmark}
          tone="teal"
          title="Which sectors are attracting capital?"
          block={a.capital}
          index={0}
          chart={<MoneyChart capital={c.capital} undisclosedCount={c.kpis.undisclosedCount} />}
          extra={
            <>
              <p className="text-xs text-muted-foreground">Bars show disclosed amounts only. The tick on each bar marks that sector&rsquo;s usual weekly amount (the light bars of the earlier design).</p>
              {c.capital.some((x) => x.undisclosed.length) ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Deals with an undisclosed amount ({c.kpis.undisclosedCount}), not counted above</summary>
                  <ul className="mt-1 grid gap-0.5 pl-4">
                    {c.capital.flatMap((x) => x.undisclosed.map((u) => (
                      <li key={u.id}>
                        {u.companyName} <span className="text-muted-foreground">({x.sector})</span>
                      </li>
                    )))}
                  </ul>
                </details>
              ) : null}
            </>
          }
        />
        <QuestionPanel
          id="pattern-momentum"
          keyName="momentum"
          icon={Flame}
          tone="amber"
          title="Is activity speeding up or slowing in your spaces?"
          block={a.momentum}
          index={1}
          chart={<HeatChart trends={c.trends} />}
          extra={
            <>
              <ul className="grid gap-1 text-xs">
                {c.trends
                  .filter((t) => t.isFocus)
                  .map((t) => (
                    <li key={t.sector} className="flex justify-between gap-2">
                      <span>{t.sector}</span>
                      <span className={t.status === "accelerating" ? "font-medium text-positive-ink" : t.status === "slowing" ? "font-medium text-warning-ink" : "text-muted-foreground"}>
                        {STATUS_TEXT[t.status]} ({t.thisWeek} vs {Math.round(t.baselineAvg * 10) / 10})
                      </span>
                    </li>
                  ))}
              </ul>
              {c.otherSectorsToNote.length ? (
                <div className="rounded-lg bg-muted/60 p-2 text-xs">
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
            </>
          }
        />
        <QuestionPanel
          id="pattern-new_investors"
          keyName="new_investors"
          icon={UserRoundPlus}
          tone="primary"
          title="Has a new investor started moving in our target sectors?"
          block={a.new_investors}
          index={2}
          chart={<FacesChart entries={c.newInvestors} sectors={focus} />}
          extra={
            <>
              {c.newInvestors.length ? (
                <ul className="grid gap-1 text-xs">
                  {invShown.map((n) => (
                    <li key={`${n.sector}-${n.investor}`}>
                      <span className="font-medium">{n.investor}</span> <span className="text-muted-foreground">in {n.sector}{n.onWatchlist ? " · investor of interest" : ""}</span>
                    </li>
                  ))}
                  {c.newInvestors.length > 10 ? (
                    <li>
                      <button type="button" onClick={() => setAllInv((v) => !v)} className="text-primary hover:underline">
                        {allInv ? "Show fewer" : `+${c.newInvestors.length - 10} more (investors of interest are listed first)`}
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : null}
              <p className="text-xs text-muted-foreground">&ldquo;New&rdquo; means new in our records for that sector, not new to the market.{c.sectorsWithoutHistory.length ? ` Not enough history to check: ${c.sectorsWithoutHistory.join(", ")}.` : ""}</p>
            </>
          }
        />
      </div>
    </div>
  );
}

/* ---------------- the deal table ---------------- */

function DealRows({ deals, onOpenDeal }: { deals: DealRowView[]; onOpenDeal: (d: DealRowView) => void }) {
  return (
    <ul className="divide-y">
      {deals.map((d, i) => (
        <motion.li key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.02 }}>
          <button
            type="button"
            onClick={() => onOpenDeal(d)}
            className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[auto_minmax(0,1.5fr)_8rem_10rem_minmax(0,1.3fr)_5.5rem_1rem]"
          >
            <CompanyLogo name={d.companyName} domain={d.domain} size={30} />
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="min-w-0 truncate text-sm font-medium">{d.companyName}</span>
              {d.matchTag && !d.needsReview ? <Chip tone={d.matchTag === "On Radar" ? "amber" : "primary"}>{d.matchTag}</Chip> : null}
              {d.needsReview ? <Chip tone="amber">review</Chip> : null}
              {d.adjacentTo.length ? <Chip tone="neutral">adjacent</Chip> : null}
            </span>
            <span className="fig text-right text-sm md:hidden">
              <Amount deal={d} />
            </span>
            <span className="col-start-2 text-xs text-muted-foreground md:col-start-auto md:text-sm">{stageLabel(d.stage)}</span>
            <span className="hidden text-sm md:block">
              <Amount deal={d} />
            </span>
            <span className="col-span-2 col-start-2 truncate text-xs text-muted-foreground md:col-span-1 md:col-start-auto">{d.investors.length ? d.investors.slice(0, 3).map((i) => i.name).join(", ") : "Investors not reported"}</span>
            <span className="fig col-start-2 text-xs text-muted-foreground md:col-start-auto md:text-right">{d.announcedOn ?? ""}</span>
            <span aria-hidden className="hidden text-muted-foreground transition-transform duration-200 group-hover:translate-x-[3px] md:block">→</span>
          </button>
        </motion.li>
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
  const [list, setList] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [limit, setLimit] = useState(PAGE);

  const stages = Array.from(new Set(view.deals.map((d) => d.stage ?? "Unknown")));
  const sectors = Array.from(new Set(view.deals.map((d) => d.sector)));
  const counts = new Map(sectors.map((s) => [s, view.deals.filter((d) => d.sector === s).length]));
  const filtered = view.deals.filter(
    (d) =>
      (sector === "all" || d.sector === sector) &&
      (stage === "all" || (d.stage ?? "Unknown") === stage) &&
      (list === "all" || (list === "watch" ? !!d.matchTag && !d.needsReview : d.matchTag === list && !d.needsReview)) &&
      (!q.trim() || d.companyName.toLowerCase().includes(q.trim().toLowerCase()) || d.investors.some((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()))),
  );
  const groups = sectors
    .map((s) => ({ sector: s, rows: filtered.filter((d) => d.sector === s), focus: focusSectors.has(s) }))
    .filter((g) => g.rows.length)
    .sort((a, b) => Number(b.focus) - Number(a.focus) || b.rows.length - a.rows.length);
  // Rows are handed out group by group until the page limit is used up.
  const sliced = groups.reduce<{ sector: string; rows: DealRowView[]; focus: boolean; isOpen: boolean; shown: DealRowView[]; left: number }[]>((acc, g) => {
    const left = acc.length ? acc[acc.length - 1].left : limit;
    // "All sectors": every group starts closed. Picking one sector opens it.
    const isOpen = open[g.sector] ?? (sector !== "all" || showAll);
    const take = isOpen ? Math.max(0, Math.min(g.rows.length, left)) : 0;
    acc.push({ ...g, isOpen, shown: g.rows.slice(0, take), left: left - take });
    return acc;
  }, []);
  const hiddenRows = groups.reduce((n, g, i) => n + (sliced[i].isOpen ? g.rows.length - sliced[i].shown.length : 0), 0);
  const chip = (active: boolean) => `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-foreground bg-foreground text-background" : "bg-card text-ink-2 hover:border-foreground/40"}`;
  return (
    <section id="all-deals" className="scroll-mt-32" aria-labelledby="all-deals-h">
      <div className="mb-3">
        <h2 id="all-deals-h" className="text-lg font-semibold tracking-tight">
          All deals this week ({view.deals.length})
        </h2>
        <p className="text-sm text-muted-foreground">Grouped by sector, all closed to start with. Open a sector, or pick one above, then select a row for details and every source link.</p>
      </div>
      <div className="mb-3 grid gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={chip(sector === "all")} aria-pressed={sector === "all"} onClick={() => { setSector("all"); setOpen({}); setLimit(PAGE); }}>
            All sectors <span className="fig opacity-70">{view.deals.length}</span>
          </button>
          {sectors.map((s) => (
            <button key={s} type="button" className={chip(sector === s)} aria-pressed={sector === s} onClick={() => { setSector(sector === s ? "all" : s); setOpen({}); setLimit(PAGE); }}>
              <span className="size-2 rounded-full" style={{ background: sectorVar(s) }} />
              {s} <span className="fig opacity-70">{counts.get(s)}</span>
            </button>
          ))}
          <button type="button" className={chip(list === "watch")} aria-pressed={list === "watch"} onClick={() => { setList(list === "watch" ? "all" : "watch"); setLimit(PAGE); }}>
            Watchlist only
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" aria-hidden />
            <Input aria-label="Search company or investor" placeholder="Search company or investor" className="h-9 rounded-full pl-9" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
          </div>
          <NativeSelect ariaLabel="Filter by stage" className="h-9 rounded-full" value={stage} onChange={(v) => { setStage(v); setLimit(PAGE); }} options={[{ value: "all", label: "All stages" }, ...stages.map((s) => ({ value: s, label: stageLabel(s) }))]} />
          <NativeSelect
            ariaLabel="Filter by list"
            className="h-9 rounded-full"
            value={list}
            onChange={(v) => { setList(v); setLimit(PAGE); }}
            options={[
              { value: "all", label: "All" },
              { value: "watch", label: "Watchlist" },
              { value: "Portfolio", label: "Portfolio" },
              { value: "On Radar", label: "On Radar" },
            ]}
          />
          {sector === "all" ? (
            <Button variant="outline" className="h-9 rounded-full" onClick={() => { setShowAll((s) => !s); setOpen({}); }} aria-pressed={showAll}>
              {showAll ? "Collapse all" : "Expand all sectors"}
            </Button>
          ) : null}
        </div>
      </div>
      {!groups.length ? (
        <EmptyState title="No deals match these filters">Clear a filter to see more.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {sliced.map((g) => {
            const disclosed = g.rows.reduce((a, r) => a + (r.amountUsd ?? 0), 0);
            return (
              <div key={g.sector} className="overflow-hidden rounded-[16px] border bg-card">
                <button type="button" aria-expanded={g.isOpen} onClick={() => setOpen((o) => ({ ...o, [g.sector]: !g.isOpen }))} className="flex w-full items-center gap-2.5 px-4 py-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
                  <ChevronDown aria-hidden className={`size-4 text-muted-foreground transition-transform duration-200 ${g.isOpen ? "" : "-rotate-90"}`} />
                  <span className="size-2.5 rounded-full" style={{ background: sectorVar(g.sector) }} />
                  <span className="text-sm font-semibold">{g.sector}</span>
                  {g.focus ? <Chip tone="primary">focus</Chip> : null}
                  <span className="fig ml-auto text-xs text-muted-foreground">
                    {plural(g.rows.length, "deal")}
                    {disclosed ? ` · ${formatUsd(disclosed)} disclosed` : ""}
                  </span>
                </button>
                <Collapse open={g.isOpen && g.shown.length > 0}>
                  <DealRows deals={g.shown} onOpenDeal={onOpenDeal} />
                </Collapse>
                {g.isOpen && g.shown.length === 0 ? (
                  <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="w-full border-t px-4 py-2.5 text-left text-xs text-primary hover:bg-muted/40">
                    {plural(g.rows.length, "deal")} not shown yet. Load more to see them.
                  </button>
                ) : null}
              </div>
            );
          })}
          {hiddenRows > 0 ? (
            <Button variant="outline" className="mx-auto rounded-full" onClick={() => setLimit((l) => l + PAGE)}>
              Load more <span className="fig ml-1 text-muted-foreground">({hiddenRows} more)</span>
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

/* ---------------- needs review ---------------- */

function NeedsReview({ view }: { view: DigestView }) {
  const items = view.digest!.patterns.needsReview ?? [];
  return (
    <section id="needs-review" className="scroll-mt-32" aria-labelledby="needs-review-h">
      <div className="mb-3 flex items-center gap-2.5">
        <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-warning-soft text-warning-ink">
          <SearchCheck className="size-4" />
        </span>
        <div>
          <h2 id="needs-review-h" className="text-lg font-semibold tracking-tight">
            Needs review ({items.length})
          </h2>
          <p className="text-sm text-muted-foreground">Names that nearly equal a company on your lists but were not an exact match. The app flags them instead of guessing.</p>
        </div>
      </div>
      {items.length ? (
        <ul className="grid gap-2.5 md:grid-cols-2">
          {items.map((r) => (
            <li key={r.dealId} className="rounded-[16px] border bg-card p-4 text-sm">
              <p>
                <span className="font-medium">{r.asWritten}</span> <span className="text-muted-foreground">(as written in the article)</span>
              </p>
              <p className="text-muted-foreground">
                Closest company on your lists: <span className="font-medium text-foreground">{r.closestCompany ?? "unknown"}</span>
                {r.closestTag ? ` (${r.closestTag})` : ""} · similarity <span className="fig">{r.score !== null ? r.score.toFixed(2) : "not recorded"}</span>
              </p>
              <p className="text-xs text-muted-foreground">{r.reason}</p>
              <SourceChips sources={r.sources} className="mt-2" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[16px] border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">None this week.</p>
      )}
    </section>
  );
}

export function MarketTab({ view, onOpenDeal }: { view: DigestView; onOpenDeal: (d: DealRowView) => void }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      {view.deals.length ? (
        <DealTable view={view} onOpenDeal={onOpenDeal} />
      ) : (
        <EmptyState title="No deals were recorded for this week">Either nothing was announced, or this week has not been collected yet. Check the data quality line above, then try Refresh or pick another week.</EmptyState>
      )}
      <NeedsReview view={view} />
      <QuestionPanels view={view} />
    </div>
  );
}
