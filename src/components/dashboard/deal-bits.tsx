"use client";

import { Popover } from "@base-ui/react/popover";
import { ExternalLink } from "lucide-react";
import { formatInr, formatUsd } from "@/lib/money";
import { hostOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DealRowView } from "@/lib/view-types";

type Src = { url: string; outlet: string | null };

function Chip({ s }: { s: Src }) {
  return (
    <a
      href={s.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-[11rem] items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="truncate">{s.outlet || hostOf(s.url)}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** Every source link, in full. Used in drawers and the report. */
export function SourceLinks({ sources, className }: { sources: Src[]; className?: string }) {
  if (!sources.length) return <span className="text-xs text-muted-foreground">No source link</span>;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {sources.map((s) => (
        <li key={s.url}>
          <Chip s={s} />
        </li>
      ))}
    </ul>
  );
}

/** At most two source chips, then "+N" that opens the full list. Never 8 to 12 links inline. */
export function SourceChips({ sources: all, className, max = 2 }: { sources: Src[]; className?: string; max?: number }) {
  if (!all.length) return <span className="text-xs text-muted-foreground">No source link</span>;
  // The same outlet often appears several times; show each outlet once and keep every link in the "+N" list.
  const firsts = all.filter((s, i, a) => a.findIndex((x) => (x.outlet ?? hostOf(x.url)) === (s.outlet ?? hostOf(s.url))) === i);
  const shown = firsts.slice(0, max);
  const rest = all.filter((s) => !shown.includes(s));
  return (
    <ul className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {shown.map((s) => (
        <li key={s.url}>
          <Chip s={s} />
        </li>
      ))}
      {rest.length ? (
        <li>
          <Popover.Root>
            <Popover.Trigger
              className="inline-flex items-center rounded-md border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground outline-none hover:border-primary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:border-primary data-popup-open:text-foreground"
              aria-label={`${rest.length} more source links`}
            >
              <span className="fig">+{rest.length}</span>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={12} className="isolate z-[70]">
                <Popover.Popup className="max-w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border bg-popover p-3 shadow-lg outline-none">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">All {all.length} sources</p>
                  <SourceLinks sources={all} />
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </li>
      ) : null}
    </ul>
  );
}

/** One amount: ₹ first, $ second, never a pile of raw strings. The raw wording lives in the drawer. */
export function Amount({ deal, withText = false }: { deal: Pick<DealRowView, "amountUsd" | "amountInr" | "amountMinUsd" | "amountMaxUsd" | "amountText">; withText?: boolean }) {
  if (deal.amountUsd === null) return <span className="text-muted-foreground">Undisclosed</span>;
  const range = deal.amountMinUsd !== null && deal.amountMaxUsd !== null;
  return (
    <span className="fig">
      <span className="font-medium">{range ? `${formatUsd(deal.amountMinUsd)} to ${formatUsd(deal.amountMaxUsd)}` : formatInr(deal.amountInr)}</span>
      {!range ? <span className="text-muted-foreground"> · {formatUsd(deal.amountUsd)}</span> : null}
      {withText && deal.amountText ? <span className="block font-sans text-xs tracking-normal text-muted-foreground">As reported: {deal.amountText}</span> : null}
    </span>
  );
}

export function confidenceLabel(c: string) {
  return c === "high" ? "Confirmed by several sources" : c === "low" ? "Low confidence: sources disagree" : "Single source";
}
