"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, ClipboardList, Flame, Landmark, Newspaper, Target, TriangleAlert, UserRoundPlus } from "lucide-react";
import { Collapse } from "@/components/common/motion-bits";
import { SECTOR_VAR } from "@/components/common/ui-bits";
import { useConfig } from "@/lib/client/api";
import { usePrefersReducedMotion } from "@/lib/client/hooks";
import { useIsPhone } from "@/lib/client/use-is-phone";
import { stageLabel } from "@/lib/format";
import { describeGroup } from "@/lib/pipeline/adjacency";
import { Amount, SourceChips } from "@/components/dashboard/deal-bits";
import { FacesChart, HeatChart, MoneyChart } from "@/components/dashboard/charts";
import { useNav } from "@/components/dashboard/nav";
import { BentoCard, Chip, InitialsAvatar, SeeAll } from "./bento";
import { Hero } from "./hero";
import type { ActionsBlock } from "@/lib/actions/types";
import type { DealRowView, DigestView } from "@/lib/view-types";

const sectorVar = (s: string) => SECTOR_VAR[s] ?? "var(--sector-other)";

function TagChip({ d }: { d: DealRowView }) {
  if (!d.matchTag || d.needsReview) return null;
  return <Chip tone={d.matchTag === "On Radar" ? "amber" : "primary"}>{d.matchTag}</Chip>;
}

/* ---------------- Your names in the news ---------------- */

export function NamesCard({ view, onOpenDeal, onSeeAll }: { view: DigestView; onOpenDeal: (d: DealRowView) => void; onSeeAll: () => void }) {
  const phone = useIsPhone();
  const reduced = usePrefersReducedMotion();
  const direct = view.deals.filter((x) => x.matchTag && !x.needsReview);
  const adjacency = view.digest!.patterns.adjacency ?? [];
  const alert = adjacency[0];
  const shown = direct.slice(0, phone ? 3 : 4);
  const total = direct.length;
  return (
    <BentoCard id="card-names" icon={Newspaper} tone="amber" title="Your names in the news" className="lg:col-span-5" index={1} action={<SeeAll onClick={onSeeAll}>{`See all${adjacency.length ? ` (${total} + ${adjacency.length} near)` : total > shown.length ? ` (${total})` : ""}`}</SeeAll>}>
      {alert ? (
        <div className="fp-ring relative mb-3 flex gap-2.5 rounded-xl border border-warning/40 bg-warning-soft p-3 text-warning-ink" role="status">
          <motion.span
            aria-hidden
            className="mt-0.5 shrink-0"
            initial={false}
            animate={reduced ? undefined : { rotate: [0, -14, 12, -8, 4, 0] }}
            transition={{ duration: 0.7, delay: 0.6 }}
          >
            <TriangleAlert className="size-4" />
          </motion.span>
          <div className="min-w-0 text-[13px] leading-snug">
            <p className="font-medium">{alert.cluster ? "Cluster near your portfolio" : "Something raised near your portfolio"}</p>
            <p className="mt-0.5">{describeGroup(alert)}</p>
          </div>
        </div>
      ) : null}
      {shown.length ? (
        <ul className="grid grid-cols-[minmax(0,1fr)]">
          {shown.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => onOpenDeal(d)} className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring">
                <InitialsAvatar name={d.companyName} sectorVar={sectorVar(d.sector)} />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate text-sm font-medium">{d.companyName}</span>
                    <TagChip d={d} />
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {stageLabel(d.stage)} · {d.sector}
                  </span>
                </span>
                <span className="max-w-[45%] shrink-0 text-right text-[13px] leading-tight">
                  <Amount deal={d} />
                </span>
                <ArrowRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-[3px]" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">No Portfolio or On Radar company was named this week.</p>
      )}
      {!alert ? <p className="mt-2 text-xs text-muted-foreground">Nothing was found next to a Portfolio company in the last few days.</p> : null}
    </BentoCard>
  );
}

/* ---------------- the three chart cards ---------------- */

export function MoneyCard({ view }: { view: DigestView }) {
  const nav = useNav();
  const c = view.digest!.patterns.computed;
  return (
    <BentoCard id="card-money" icon={Landmark} tone="teal" title="Where the money went" className="lg:col-span-7" index={2} action={<SeeAll onClick={() => nav.jump("market", "pattern-capital", { expand: "capital" })}>Read the analysis</SeeAll>}>
      <p className="mb-3 text-sm text-ink-2">{view.digest!.analysis.capital.headline ?? view.digest!.analysis.capital.summary}</p>
      <MoneyChart capital={c.capital} undisclosedCount={c.kpis.undisclosedCount} />
    </BentoCard>
  );
}

export function HeatCard({ view }: { view: DigestView }) {
  const nav = useNav();
  const c = view.digest!.patterns.computed;
  return (
    <BentoCard id="card-heat" icon={Flame} tone="amber" title="Who's heating up" className="lg:col-span-6" index={3} action={<SeeAll onClick={() => nav.jump("market", "pattern-momentum", { expand: "momentum" })}>Read the analysis</SeeAll>}>
      <p className="mb-3 text-sm text-ink-2">{view.digest!.analysis.momentum.headline ?? view.digest!.analysis.momentum.summary}</p>
      <HeatChart trends={c.trends} />
    </BentoCard>
  );
}

export function FacesCard({ view }: { view: DigestView }) {
  const nav = useNav();
  const { data: cfg } = useConfig();
  const c = view.digest!.patterns.computed;
  const interest = c.newInvestors.filter((n) => n.onWatchlist);
  const focus = cfg?.mandate.focus_sectors ?? c.trends.filter((t) => t.isFocus).map((t) => t.sector);
  return (
    <BentoCard id="card-faces" icon={UserRoundPlus} tone="primary" title="New faces at the table" className="lg:col-span-6" index={4} action={<SeeAll onClick={() => nav.jump("market", "pattern-new_investors", { expand: "new_investors" })}>Read the analysis</SeeAll>}>
      <p className="mb-3 text-sm text-ink-2">{view.digest!.analysis.new_investors.headline ?? view.digest!.analysis.new_investors.summary}</p>
      <FacesChart entries={c.newInvestors} sectors={focus} />
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Investors you watch, new in our records</p>
        {interest.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {interest.slice(0, 8).map((n, i) => (
              <motion.li key={`${n.sector}-${n.investor}`} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.06, duration: 0.3 }}>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
                  <span className="size-2 rounded-full" style={{ background: sectorVar(n.sector) }} />
                  {n.investor}
                </span>
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">None of the investors you watch are new in a focus sector this week.</p>
        )}
      </div>
    </BentoCard>
  );
}

/* ---------------- Deals that fit the mandate ---------------- */

export function FitCard({ view, onOpenDeal }: { view: DigestView; onOpenDeal: (d: DealRowView) => void }) {
  const { data: cfg } = useConfig();
  const phone = useIsPhone();
  const list = view.digest!.highlights;
  const top = phone ? 3 : (cfg?.digest_settings.highlights_top ?? 5);
  const total = cfg?.digest_settings.highlights_total ?? 15;
  const [all, setAll] = useState(false);
  const byId = new Map(view.deals.map((d) => [d.id, d]));
  const row = (h: (typeof list)[number]) => {
    const deal = byId.get(h.dealId);
    return (
      <li key={h.dealId}>
        <div
          onClick={() => {
            if (deal) onOpenDeal(deal);
          }}
          className="group flex cursor-pointer gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/70"
        >
          <span className="fig mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-medium text-accent-foreground">{h.rank}</span>
          <InitialsAvatar name={h.companyName} sectorVar={sectorVar(h.sector)} size={30} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <button type="button" disabled={!deal} onClick={(e) => {
                e.stopPropagation();
                if (deal) onOpenDeal(deal);
              }} className="rounded text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                {h.companyName}
              </button>
              {h.matchTag && !(deal?.needsReview) ? <Chip tone={h.matchTag === "On Radar" ? "amber" : "primary"}>{h.matchTag}</Chip> : null}
              <span className="text-xs text-muted-foreground">
                {h.sector} · {stageLabel(h.stage)}
              </span>
              <span className="ml-auto text-sm">{deal ? <Amount deal={deal} /> : null}</span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2">{h.why}</p>
            <SourceChips sources={h.sources} className="mt-1.5" />
          </div>
        </div>
      </li>
    );
  };
  if (!list.length) return null;
  const rest = list.slice(top, total);
  return (
    <BentoCard id="card-fit" icon={Target} tone="primary" title="Deals that fit the mandate" className="lg:col-span-8" index={5}>
      <p className="mb-2 text-xs text-muted-foreground">Ranked by fit with the mandate, size, watchlist involvement, new-investor entry and novelty.</p>
      <ol className="grid grid-cols-[minmax(0,1fr)]">{list.slice(0, top).map(row)}</ol>
      <Collapse open={all}>
        <ol className="grid grid-cols-[minmax(0,1fr)]">{rest.map(row)}</ol>
      </Collapse>
      {rest.length ? (
        <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className="mt-2 inline-flex items-center gap-1 rounded-md px-1 text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
          {all ? "Show fewer" : `Show ${rest.length} more`}
          <span aria-hidden className={`inline-block transition-transform duration-200 ${all ? "rotate-180" : ""}`}>⌄</span>
        </button>
      ) : null}
    </BentoCard>
  );
}

/* ---------------- Your Monday to-do ---------------- */

function Big({ children, sub, onClick, disabled }: { children: React.ReactNode; sub: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border bg-background/60 px-4 py-3 text-left outline-none transition-[transform,border-color] duration-150 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{children}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
      <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-[3px]" />
    </button>
  );
}

export function TodoCard({ view }: { view: DigestView }) {
  const nav = useNav();
  const a = view.digest!.actions as Partial<ActionsBlock>;
  const built = !!a.founderOutreach;
  const f = a.founderOutreach?.length ?? 0;
  const p = a.portfolioFollowUp?.length ?? 0;
  const review = view.quality.needsReview;
  return (
    <BentoCard id="card-todo" icon={ClipboardList} tone="teal" title="Your Monday to-do" className="lg:col-span-4" index={6}>
      <div className="grid gap-2.5">
        <Big sub="With a draft note for each" onClick={() => nav.jump("actions", "founders")} disabled={!built}>
          Reach out to {f || 5} founders
        </Big>
        <Big sub="Where something raised nearby" onClick={() => nav.jump("actions", "checkins")} disabled={!built}>
          Check in with {p} portfolio {p === 1 ? "company" : "cos"}
        </Big>
        <Big sub="Draft ready to review" onClick={() => nav.jump("actions", "lp-note")} disabled={!built}>
          Send the LP note
        </Big>
      </div>
      {!built ? <p className="mt-2 text-xs text-muted-foreground">Action items are built when a refresh finishes for the week.</p> : null}
      {review ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-ink-2">
          <Check aria-hidden className="size-3.5 text-warning-ink" />
          <span>
            {review} {review === 1 ? "name" : "names"} to review.
          </span>
          <button type="button" onClick={() => nav.jump("market", "needs-review")} className="ml-auto font-medium text-primary hover:underline">
            Check
          </button>
        </p>
      ) : null}
    </BentoCard>
  );
}

/* ---------------- the Brief tab ---------------- */

export function BriefTab({ view, onOpenDeal, onOpenFocus, onSeeAllNames }: { view: DigestView; onOpenDeal: (d: DealRowView) => void; onOpenFocus: () => void; onSeeAllNames: () => void }) {
  return (
    <div className="grid min-w-0 grid-cols-12 gap-4">
      <Hero view={view} onOpenFocus={onOpenFocus} />
      <div className="col-span-12 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12">
        <NamesCard view={view} onOpenDeal={onOpenDeal} onSeeAll={onSeeAllNames} />
        <MoneyCard view={view} />
        <HeatCard view={view} />
        <FacesCard view={view} />
        <FitCard view={view} onOpenDeal={onOpenDeal} />
        <TodoCard view={view} />
      </div>
    </div>
  );
}
