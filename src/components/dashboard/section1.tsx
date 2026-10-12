"use client";

import { ArrowDown } from "lucide-react";
import { CompanyLogo, SectorDot, TagBadge } from "@/components/common/ui-bits";
import { EmptyState } from "@/components/common/states";
import { describeGroup } from "@/lib/pipeline/adjacency";
import { Amount, SourceLinks } from "./deal-bits";
import { CapitalChart, MomentumChart, NewInvestorChart } from "./charts";
import type { DealRowView, DigestView } from "@/lib/view-types";

function Heading({ id, children, hint }: { id: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {children}
      </h2>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Section1({ view, onOpenDeal }: { view: DigestView; onOpenDeal: (d: DealRowView) => void }) {
  const d = view.digest!;
  const focusIds = new Set(d.patterns.computed.focusDealIds);
  const focus = view.deals.filter((x) => focusIds.has(x.id)).slice(0, 6);
  const direct = view.deals.filter((x) => x.matchTag);
  const adjacency = d.patterns.adjacency ?? [];
  const byKey: Record<string, React.ReactNode> = {
    capital: <CapitalChart capital={d.patterns.computed.capital} compact />,
    momentum: <MomentumChart trends={d.patterns.computed.trends} compact />,
    new_investors: <NewInvestorChart entries={d.patterns.computed.newInvestors} compact />,
  };
  return (
    <section aria-labelledby="s1" className="grid gap-8">
      <div>
        <h2 id="s1" className="text-xl font-semibold tracking-tight">
          This week at a glance
        </h2>
      </div>

      <div>
        <Heading id="s1-focus" hint="Focus sector and a stage the mandate invests in. Series B+ only when the company is on your lists.">
          Focus deals
        </Heading>
        {focus.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {focus.map((x, i) => (
              <li key={x.id} className="fp-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                <button type="button" onClick={() => onOpenDeal(x)} className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
                  <CompanyLogo name={x.companyName} domain={x.domain} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{x.companyName}</span>
                      {x.matchTag ? <TagBadge tag={x.matchTag} /> : null}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <SectorDot sector={x.sector} />
                      {x.sector} · {x.stage ?? "Unknown"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <Amount deal={x} withText={false} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No focus deals this week">Nothing matched the mandate&rsquo;s sectors and stages. All deals are listed in the market overview below.</EmptyState>
        )}
      </div>

      <div>
        <Heading id="s1-patterns" hint="Computed from the stored deals. Select one for the full explanation and sources.">
          Top 3 patterns
        </Heading>
        <ul className="grid gap-3 md:grid-cols-3">
          {d.patterns.items.map((p, i) => (
            <li key={p.key} className="fp-fade-in rounded-xl border bg-card p-4" style={{ animationDelay: `${i * 40}ms` }}>
              <h3 className="text-sm font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.oneLine}</p>
              <div className="mt-2">{byKey[p.key]}</div>
              <a href={`#pattern-${p.key}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline">
                Details and sources <ArrowDown className="size-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <Heading id="s1-watch" hint="Direct means the company itself was named. Adjacent means something happened in the same space as a Portfolio company.">
          Watchlist hits
        </Heading>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Direct ({direct.length})</h3>
            {direct.length ? (
              <ul className="grid gap-2">
                {direct.map((x) => (
                  <li key={x.id} className="fp-pulse-once rounded-xl border bg-card p-3">
                    <button type="button" onClick={() => onOpenDeal(x)} className="flex w-full items-start gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                      <CompanyLogo name={x.companyName} domain={x.domain} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                          {x.companyName} {x.matchTag ? <TagBadge tag={x.matchTag} /> : null}
                          {x.needsReview ? <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[0.68rem] text-warning">needs review</span> : null}
                        </span>
                        <span className="block text-xs text-muted-foreground">{x.matchReason}</span>
                        <span className="mt-0.5 block text-xs">
                          {x.stage ?? "Unknown"} · <Amount deal={x} withText={false} />
                        </span>
                      </span>
                    </button>
                    <SourceLinks sources={x.sources} className="mt-2" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No Portfolio or On Radar company was named this week.</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Adjacent to your portfolio ({adjacency.length})</h3>
            {adjacency.length ? (
              <ul className="grid gap-2">
                {adjacency.map((g) => (
                  <li key={g.portfolioId} className="fp-pulse-once rounded-xl border bg-card p-3">
                    <p className="text-sm font-medium">{describeGroup(g)}</p>
                    <ul className="mt-2 grid gap-2">
                      {g.items.map((it) => (
                        <li key={it.dealId} className="rounded-lg bg-muted/50 px-2.5 py-2 text-xs">
                          <span className="font-medium">{it.companyName}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {it.stage ?? "Unknown"} · {it.amountText ?? "Undisclosed"} · {it.announcedOn}
                          </span>
                          <span className="block text-muted-foreground">Shared: {it.sharedTerms.join(", ")}</span>
                          <SourceLinks sources={it.sources} className="mt-1" />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Nothing was found next to a Portfolio company in the last few days.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
