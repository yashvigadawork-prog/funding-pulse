import Link from "next/link";
import { stageLabel } from "@/lib/format";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import { PrintTrigger } from "@/components/report-bits";
import { FacesChart, HeatChart, MoneyChart, StaticCharts } from "@/components/dashboard/charts";
import { Amount, SourceLinks } from "@/components/dashboard/deal-bits";
import { loadDigestView } from "@/lib/digest-view";
import { describeGroup } from "@/lib/pipeline/adjacency";
import { formatInr, formatUsd } from "@/lib/money";
import { formatDateTimeIST, formatWeekRange, isValidDay } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata: Metadata = { title: "Funding Pulse report" };

const STATUS = { accelerating: "Speeding up", slowing: "Slowing", steady: "Steady", not_enough_history: "Not enough history" } as const;

export default async function ReportPage({ params, searchParams }: PageProps<"/report/[week]">) {
  const { week } = await params;
  const sp = await searchParams;
  if (!isValidDay(week)) notFound();
  const view = await loadDigestView(week);
  const d = view.digest;
  if (!d || view.week !== week) notFound();
  const c = d.patterns.computed;
  const k = d.kpis;
  const adjacency = d.patterns.adjacency ?? [];
  const review = d.patterns.needsReview ?? [];
  const direct = view.deals.filter((x) => x.matchTag);
  const actions = d.actions as { portfolioFollowUp?: { company: string; headline: string }[]; lpBrief?: { keyPoints: { text: string; url: string | null }[] } };
  return (
    <StaticCharts>
      <div className="mx-auto max-w-4xl px-4 py-6 text-[15px] print-links">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-2">
          <Link href={`/?week=${week}`} className="text-sm text-primary underline underline-offset-2">
            Back to the dashboard
          </Link>
          <div className="flex gap-2">
            <ThemeToggle />
            <PrintTrigger auto={sp.print === "1"} />
          </div>
        </div>

        {/* Page 1: cover and key numbers */}
        <section className="print-page grid content-start gap-5 pb-10">
          <p className="text-sm text-muted-foreground">{view.fundName}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Funding Pulse</h1>
          <p className="text-lg">{formatWeekRange(week)}</p>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["Deals", String(k.deals)],
              ["Disclosed capital", k.disclosedUsd > 0 ? `${formatInr(k.disclosedInr)} (${formatUsd(k.disclosedUsd)})` : "None disclosed"],
              ["Top sector", k.topSector ?? "None yet"],
              ["Watchlist hits", `${k.directHits ?? k.watchlistHits} direct${k.adjacentHits ? `, ${k.adjacentHits} adjacent` : ""}`],
              ["New investors", `${k.newInvestors} new in our records`],
            ].map(([label, value]) => (
              <div key={label} className="print-avoid-break rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">
            Data quality: {view.quality.sources ? `${view.quality.sources.reachable} of ${view.quality.sources.total} sources reachable` : "sources not checked"}; {view.quality.articlesRead} articles read this week; {view.quality.dealsFound} deals found after merging duplicates; {view.quality.undisclosed} with an undisclosed amount (never added up); {view.quality.needsReview} needing review. Generated {formatDateTimeIST(d.createdAt)}.
          </p>
          {d.analysis.source === "template" ? <p className="text-sm text-muted-foreground">{d.analysis.reason === "ai_unavailable" ? "Written from a template because the AI service was unavailable. The numbers are unaffected." : "Plain summary written from the numbers for a week loaded from earlier data."}</p> : null}
          <h2 className="text-xl font-semibold">Focus deals and watchlist</h2>
          <ul className="grid gap-2">
            {view.deals.filter((x) => c.focusDealIds.includes(x.id)).slice(0, 8).map((x) => (
              <li key={x.id} className="print-avoid-break rounded-lg border p-3 text-sm">
                <span className="font-medium">{x.companyName}</span> {x.matchTag ? `(${x.matchTag})` : ""} · {x.sector} · {stageLabel(x.stage)} · <Amount deal={x} withText={false} />
                <SourceLinks sources={x.sources} className="mt-1" />
              </li>
            ))}
          </ul>
          <h3 className="font-semibold">Direct ({direct.length})</h3>
          <ul className="grid gap-1 text-sm">
            {direct.map((x) => (
              <li key={x.id}>
                {x.companyName} ({x.matchTag}): {x.matchReason}
              </li>
            ))}
            {!direct.length ? <li className="text-muted-foreground">No Portfolio or On Radar company was named.</li> : null}
          </ul>
          <h3 className="font-semibold">Adjacent to your portfolio ({adjacency.length})</h3>
          <ul className="grid gap-2 text-sm">
            {adjacency.map((g) => (
              <li key={g.portfolioId} className="print-avoid-break">
                {describeGroup(g)}
                <ul className="mt-1 grid gap-1 pl-4">
                  {g.items.map((i) => (
                    <li key={i.dealId}>
                      {i.companyName} · {stageLabel(i.stage)} · {i.amountText ?? "Undisclosed"} · {i.announcedOn}
                      <SourceLinks sources={i.sources} className="mt-0.5" />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {!adjacency.length ? <li className="text-muted-foreground">Nothing found next to a Portfolio company.</li> : null}
          </ul>
        </section>

        {/* Page 2: the three questions */}
        <section className="print-page grid content-start gap-6 pb-10">
          <h2 className="text-xl font-semibold">The three questions</h2>
          {[
            { title: "Which sectors are attracting capital?", block: d.analysis.capital, chart: <MoneyChart capital={c.capital} undisclosedCount={c.kpis.undisclosedCount} /> },
            { title: "Is activity speeding up or slowing in your spaces?", block: d.analysis.momentum, chart: <HeatChart trends={c.trends} /> },
            { title: "Has a new investor started moving in our target sectors?", block: d.analysis.new_investors, chart: <FacesChart entries={c.newInvestors} sectors={c.trends.filter((t) => t.isFocus).map((t) => t.sector)} /> },
          ].map((p) => (
            <article key={p.title} className="print-avoid-break">
              <h3 className="font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm">{p.block.summary}</p>
              {p.chart}
              <ul className="mt-1 grid gap-2 text-sm">
                {p.block.points.map((pt, i) => (
                  <li key={i}>
                    <strong>{pt.label}:</strong> {pt.text}
                    <SourceLinks sources={pt.sources} className="mt-0.5" />
                  </li>
                ))}
              </ul>
            </article>
          ))}
          <ul className="grid gap-1 text-sm">
            {c.trends.filter((t) => t.isFocus).map((t) => (
              <li key={t.sector}>
                {t.sector}: {STATUS[t.status]} ({t.thisWeek} deals vs baseline average {Math.round(t.baselineAvg * 10) / 10})
              </li>
            ))}
          </ul>
        </section>

        {/* Page 3: highlights */}
        <section className="print-page grid content-start gap-4 pb-10">
          <h2 className="text-xl font-semibold">Top highlights</h2>
          <ol className="grid gap-3">
            {d.highlights.slice(0, 10).map((h) => (
              <li key={h.dealId} className="print-avoid-break rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {h.rank}. {h.companyName} {h.matchTag ? `(${h.matchTag})` : ""}
                </p>
                <p className="text-muted-foreground">
                  {h.sector} · {stageLabel(h.stage)} · {h.amountUsd !== null ? `${formatInr(h.amountInr)} (${formatUsd(h.amountUsd)})` : "Undisclosed"}
                </p>
                <p>{h.why}</p>
                <SourceLinks sources={h.sources} className="mt-1" />
              </li>
            ))}
          </ol>
        </section>

        {/* Page 4: every deal */}
        <section className="print-page grid content-start gap-3 pb-10">
          <h2 className="text-xl font-semibold">All deals ({view.deals.length})</h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1 pr-2">Company</th>
                <th className="pr-2">Sector</th>
                <th className="pr-2">Stage</th>
                <th className="pr-2">Amount (as reported)</th>
                <th>Sources</th>
              </tr>
            </thead>
            <tbody>
              {view.deals.map((x) => (
                <tr key={x.id} className="print-avoid-break border-b align-top">
                  <td className="py-1 pr-2 font-medium">{x.companyName}</td>
                  <td className="pr-2">{x.sector}</td>
                  <td className="pr-2">{stageLabel(x.stage)}</td>
                  <td className="pr-2">{x.amountText ?? "Undisclosed"}</td>
                  <td>
                    <SourceLinks sources={x.sources} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-4 font-semibold">Needs review ({review.length})</h3>
          <ul className="grid gap-1 text-sm">
            {review.map((r) => (
              <li key={r.dealId}>
                {r.asWritten} is close to {r.closestCompany ?? "a listed company"} (similarity {r.score?.toFixed(2) ?? "n/a"}). {r.reason}.
              </li>
            ))}
            {!review.length ? <li className="text-muted-foreground">None this week.</li> : null}
          </ul>
        </section>

        {/* Page 5: actions */}
        <section className="print-page grid content-start gap-3 pb-6">
          <h2 className="text-xl font-semibold">Action items</h2>
          <h3 className="font-semibold">Portfolio follow-up</h3>
          <ul className="grid gap-1 text-sm">
            {(actions.portfolioFollowUp ?? []).map((f) => (
              <li key={f.company}>
                {f.company}: {f.headline}
              </li>
            ))}
            {!(actions.portfolioFollowUp ?? []).length ? <li className="text-muted-foreground">Nothing to follow up this week.</li> : null}
          </ul>
          <h3 className="font-semibold">LP brief key points</h3>
          <ul className="grid gap-1 text-sm">
            {(actions.lpBrief?.keyPoints ?? []).map((p, i) => (
              <li key={i}>
                {p.text} {p.url ? <a href={p.url}>{p.url}</a> : null}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-muted-foreground">Every claim links to its source. Amounts that were not disclosed are never guessed or added up. Rates use the configured USD to INR rate.</p>
        </section>
      </div>
    </StaticCharts>
  );
}
