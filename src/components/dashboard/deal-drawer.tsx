"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CompanyLogo, SectorDot, TagBadge } from "@/components/common/ui-bits";
import { formatDay } from "@/lib/time";
import { Amount, confidenceLabel, SourceLinks } from "./deal-bits";
import type { DealRowView } from "@/lib/view-types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 border-b py-2.5 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export function DealDrawer({ deal, onClose }: { deal: DealRowView | null; onClose: () => void }) {
  return (
    <Sheet open={!!deal} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="data-[side=right]:sm:max-w-lg">
        {deal ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3 pr-8">
                <CompanyLogo name={deal.companyName} domain={deal.domain} size={36} />
                <div className="min-w-0">
                  <SheetTitle className="flex flex-wrap items-center gap-2">
                    {deal.companyName}
                    {deal.matchTag ? <TagBadge tag={deal.matchTag} /> : null}
                  </SheetTitle>
                  <SheetDescription className="flex items-center gap-1.5">
                    <SectorDot sector={deal.sector} /> {deal.sector}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <dl className="overflow-y-auto px-4 pb-6">
              <Row label="Stage">{deal.stage ?? "Unknown"}</Row>
              <Row label="Amount">
                <Amount deal={deal} />
              </Row>
              <Row label="Date">{deal.announcedOn ? formatDay(deal.announcedOn) : "Not reported"}</Row>
              <Row label="Lead investors">
                {deal.investors.filter((i) => i.role === "lead").length ? deal.investors.filter((i) => i.role === "lead").map((i) => i.name).join(", ") : <span className="text-muted-foreground">Not reported</span>}
              </Row>
              <Row label="Other investors">
                {deal.investors.filter((i) => i.role !== "lead").length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {deal.investors.filter((i) => i.role !== "lead").map((i) => (
                      <li key={i.name} className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                        {i.name}
                        {i.newInSector ? <span className="text-primary"> · new in our records</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">Not reported</span>
                )}
              </Row>
              <Row label="Founders">
                {deal.founders.length ? deal.founders.map((f) => (f.role ? `${f.name} (${f.role})` : f.name)).join(", ") : <span className="text-muted-foreground">Not found</span>}
              </Row>
              <Row label="About">{deal.summary ?? <span className="text-muted-foreground">Not reported</span>}</Row>
              <Row label="Confidence">{confidenceLabel(deal.confidence)}</Row>
              {deal.matchTag ? <Row label="Watchlist match">{deal.matchReason}</Row> : null}
              {deal.adjacentTo.length ? (
                <Row label="Adjacent to">
                  <ul className="grid gap-1">
                    {deal.adjacentTo.map((a) => (
                      <li key={a.portfolioName}>
                        <span className="font-medium">{a.portfolioName}</span>
                        <span className="text-muted-foreground"> · shares {a.sharedTerms.join(", ")}</span>
                      </li>
                    ))}
                  </ul>
                </Row>
              ) : null}
              <Row label="Sources">
                <SourceLinks sources={deal.sources} />
              </Row>
            </dl>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
