"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SECTOR_VAR } from "@/components/common/ui-bits";
import { stageLabel } from "@/lib/format";
import { describeGroup } from "@/lib/pipeline/adjacency";
import { Amount, SourceLinks } from "@/components/dashboard/deal-bits";
import { Chip, InitialsAvatar } from "./bento";
import type { DealRowView, DigestView } from "@/lib/view-types";

const sectorVar = (s: string) => SECTOR_VAR[s] ?? "var(--sector-other)";

function DealRowFull({ d, onOpen, why }: { d: DealRowView; onOpen: (d: DealRowView) => void; why?: string | null }) {
  return (
    <li className="rounded-xl border bg-card p-3">
      <button type="button" onClick={() => onOpen(d)} className="flex w-full items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <InitialsAvatar name={d.companyName} sectorVar={sectorVar(d.sector)} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            {d.companyName}
            {d.matchTag ? <Chip tone={d.matchTag === "On Radar" ? "amber" : "primary"}>{d.matchTag}</Chip> : null}
            {d.needsReview ? <Chip tone="amber">needs review</Chip> : null}
          </span>
          {why ? <span className="block text-xs text-muted-foreground">{why}</span> : null}
          <span className="mt-0.5 block text-xs">
            {stageLabel(d.stage)} · {d.sector} · <Amount deal={d} />
          </span>
        </span>
      </button>
      <SourceLinks sources={d.sources} className="mt-2" />
    </li>
  );
}

/** The focus-deal list, opened from the Focus deals tile. */
export function FocusDrawer({ view, open, onClose, onOpenDeal }: { view: DigestView; open: boolean; onClose: () => void; onOpenDeal: (d: DealRowView) => void }) {
  const ids = new Set(view.digest?.patterns.computed.focusDealIds ?? []);
  const focus = view.deals.filter((x) => ids.has(x.id));
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Focus deals ({focus.length})</SheetTitle>
          <SheetDescription>Focus sector and a stage the mandate invests in. Series B+ only when the company is on your lists.</SheetDescription>
        </SheetHeader>
        <ul className="grid gap-2.5 overflow-y-auto px-4 pb-6">
          {focus.length ? focus.map((d) => <DealRowFull key={d.id} d={d} onOpen={onOpenDeal} />) : <li className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Nothing matched the mandate&rsquo;s sectors and stages this week. All deals are listed on the Market tab.</li>}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

/** Every direct hit and every adjacent group, in full. */
export function NamesDrawer({ view, open, onClose, onOpenDeal }: { view: DigestView; open: boolean; onClose: () => void; onOpenDeal: (d: DealRowView) => void }) {
  const direct = view.deals.filter((x) => x.matchTag && !x.needsReview);
  const adjacency = view.digest?.patterns.adjacency ?? [];
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Your names in the news</SheetTitle>
          <SheetDescription>Direct means the company itself was named. Adjacent means something happened in the same space as a Portfolio company.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 overflow-y-auto px-4 pb-6">
          <section aria-label="Direct hits">
            <h3 className="mb-2 text-sm font-semibold">Direct ({direct.length})</h3>
            {direct.length ? (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
                {direct.map((d) => (
                  <DealRowFull key={d.id} d={d} onOpen={onOpenDeal} why={d.matchReason} />
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">No Portfolio or On Radar company was named this week.</p>
            )}
          </section>
          <section aria-label="Adjacent to your portfolio">
            <h3 className="mb-2 text-sm font-semibold">Adjacent to your portfolio ({adjacency.length})</h3>
            {adjacency.length ? (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
                {adjacency.map((g) => (
                  <li key={g.portfolioId} className="rounded-xl border border-warning/30 bg-warning-soft/40 p-3">
                    <p className="text-sm font-medium">{describeGroup(g)}</p>
                    <ul className="mt-2 grid gap-2">
                      {g.items.map((it) => (
                        <li key={it.dealId} className="rounded-lg bg-card px-3 py-2 text-xs">
                          <span className="font-medium">{it.companyName}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {stageLabel(it.stage)} · {it.announcedOn}
                          </span>
                          <span className="ml-1">
                            {it.amountUsd !== null && it.amountUsd !== undefined ? <Amount deal={{ amountUsd: it.amountUsd, amountInr: it.amountInr, amountMinUsd: null, amountMaxUsd: null, amountText: it.amountText }} /> : <span className="text-muted-foreground">Undisclosed</span>}
                          </span>
                          <span className="block text-muted-foreground">Shared: {it.sharedTerms.join(", ")}</span>
                          <SourceLinks sources={it.sources} className="mt-1.5" />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">Nothing was found next to a Portfolio company in the last few days.</p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
