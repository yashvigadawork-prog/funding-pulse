"use client";

import { Banner } from "@/components/common/states";
import { timeAgo } from "@/lib/format";
import type { DigestView } from "@/lib/view-types";

/** Warnings that apply to the whole page. (The "written from a template" notice sits with the analysis.) */
export function StatusBanners({ view }: { view: DigestView }) {
  const q = view.quality;
  const out: React.ReactNode[] = [];
  if (q.daysOld !== null && q.daysOld > 8)
    out.push(
      <Banner key="stale" tone="warn" title={`Last updated ${q.daysOld} days ago`}>
        The numbers below may be out of date. Press Refresh now to collect the latest news.
      </Banner>,
    );
  if (q.searchUnavailable)
    out.push(
      <Banner key="search" tone="warn" title="Live search is unavailable">
        Showing stored data from {q.lastUpdatedAt ? timeAgo(q.lastUpdatedAt) : "the last run"}.
      </Banner>,
    );
  if (q.partialRun)
    out.push(
      <Banner key="partial" tone="info" title="Some articles are still waiting">
        Press Refresh again to continue.
      </Banner>,
    );
  if (!out.length) return null;
  return <div className="grid gap-2">{out}</div>;
}
