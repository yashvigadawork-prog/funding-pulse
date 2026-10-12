"use client";

import { Clock, EyeOff, FileText, Layers, Radio, SearchCheck } from "lucide-react";
import { InfoTip } from "@/components/common/info-tip";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNav } from "./nav";
import type { DigestView } from "@/lib/view-types";

function Seg({ icon: Icon, text, tip, label }: { icon: typeof Radio; text: React.ReactNode; tip: React.ReactNode; label: string }) {
  return (
    <InfoTip
      label={label}
      width="w-72"
      side="bottom"
      trigger={
        <>
          <Icon aria-hidden className="size-3.5 text-muted-foreground" />
          <span>{text}</span>
        </>
      }
    >
      <p className="text-sm text-popover-foreground">{tip}</p>
    </InfoTip>
  );
}

/** One slim line of data-quality facts. Every figure comes from the database or the last collection record. */
export function DataStrip({ view }: { view: DigestView }) {
  const nav = useNav();
  const q = view.quality;
  const unreachable = q.sources?.unreachable ?? [];
  const below = !!view.digest && q.dealsFound < q.typicalVolume.min;
  const fresh = q.fresh;
  return (
    <div className="border-b bg-surface/70">
      <div className="mx-auto max-w-[88rem] px-4 py-1.5 md:px-6">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs" role="status" aria-label="Data quality">
          <Seg
            icon={Radio}
            label="About the sources"
            text={<span className="fig">{q.sources ? `${q.sources.reachable} of ${q.sources.total} sources reached` : "Sources not checked yet"}</span>}
            tip={
              q.sources
                ? unreachable.length
                  ? `Could not read the feed of: ${unreachable.join(", ")}.${q.sources.searchedInstead.length ? ` Searched their websites instead: ${q.sources.searchedInstead.join(", ")}.` : ""}`
                  : "All sources answered."
                : "No collection has been recorded yet."
            }
          />
          <span aria-hidden className="text-border">·</span>
          <Seg icon={FileText} label="About the articles" text={<span className="fig">{q.articlesRead} articles</span>} tip={`Articles read this week: ${q.articlesRead}. Each one is read in full, and every funding round in it is pulled out.`} />
          <span aria-hidden className="text-border">·</span>
          <Seg
            icon={Layers}
            label="About the deal count"
            text={<span className="fig">{q.dealsFound} deals <span className="text-muted-foreground">(typical {q.typicalVolume.min}–{q.typicalVolume.max})</span></span>}
            tip="Deals found this week after duplicates were merged, shown against the typical weekly volume of announcements."
          />
          <span aria-hidden className="text-border">·</span>
          <Seg icon={EyeOff} label="About undisclosed amounts" text={<span className="fig">{q.undisclosed} undisclosed</span>} tip="Deals whose amount was not reported. They are counted as deals, listed separately, and never added into capital totals." />
          <span aria-hidden className="text-border">·</span>
          <button
            type="button"
            onClick={() => nav.jump("market", "needs-review")}
            className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SearchCheck aria-hidden className="size-3.5 text-muted-foreground" />
            <span className="fig">{q.needsReview} {q.needsReview === 1 ? "name" : "names"} to review</span>
          </button>
          <span aria-hidden className="text-border">·</span>
          <Seg
            icon={Clock}
            label="About freshness"
            text={
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn("size-1.5 rounded-full", fresh ? "fp-live bg-positive" : "bg-muted-foreground/60")} />
                <span className="fig">Updated {q.lastUpdatedAt ? timeAgo(q.lastUpdatedAt) : "never"}</span>
              </span>
            }
            tip={fresh ? "The data is under a day old." : "The data is more than a day old. Press Refresh to collect the latest news."}
          />
        </div>
        {below ? (
          <p className="pt-0.5 text-xs text-muted-foreground">Below the typical weekly volume. Possible reasons: some sources unreachable, or earlier weeks not yet collected.</p>
        ) : null}
      </div>
    </div>
  );
}
