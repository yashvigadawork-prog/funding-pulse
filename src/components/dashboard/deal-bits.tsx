"use client";

import { ExternalLink } from "lucide-react";
import { formatInr, formatUsd } from "@/lib/money";
import { hostOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DealRowView } from "@/lib/view-types";

export function SourceLinks({ sources, className }: { sources: { url: string; outlet: string | null }[]; className?: string }) {
  if (!sources.length) return <span className="text-xs text-muted-foreground">No source link</span>;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {sources.map((s) => (
        <li key={s.url}>
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground underline-offset-2 hover:underline"
          >
            {s.outlet || hostOf(s.url)}
            <ExternalLink className="size-3" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** "₹40 Cr ($4.2M)", a range when outlets disagree, or Undisclosed. The original text is always kept beside it. */
export function Amount({ deal, withText = true }: { deal: Pick<DealRowView, "amountUsd" | "amountInr" | "amountMinUsd" | "amountMaxUsd" | "amountText">; withText?: boolean }) {
  if (deal.amountUsd === null) return <span className="text-muted-foreground">Undisclosed</span>;
  const range = deal.amountMinUsd !== null && deal.amountMaxUsd !== null;
  return (
    <span>
      <span className="font-medium">{range ? `${formatUsd(deal.amountMinUsd)} to ${formatUsd(deal.amountMaxUsd)}` : formatInr(deal.amountInr)}</span>
      {!range ? <span className="text-muted-foreground"> ({formatUsd(deal.amountUsd)})</span> : null}
      {withText && deal.amountText ? <span className="block text-xs text-muted-foreground">As reported: {deal.amountText}</span> : null}
    </span>
  );
}

export function confidenceLabel(c: string) {
  return c === "high" ? "Confirmed by several sources" : c === "low" ? "Low confidence: sources disagree" : "Single source";
}
