import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Banner, EmptyState, ErrorRetry } from "./states";
import { StatusBanners } from "@/components/dashboard/kpis";
import type { DigestView } from "@/lib/view-types";

const base = { sources: { total: 13, reachable: 5, unreachable: ["A"] }, articlesRead: 5, dealsFound: 5, undisclosed: 0, needsReview: 0, lastUpdatedAt: new Date().toISOString(), daysOld: 1, typicalVolume: { min: 40, max: 60 }, searchUnavailable: false, partialRun: false };
const view = (q: Partial<typeof base>) => ({ quality: { ...base, ...q }, digest: null }) as unknown as DigestView;

describe("designed failure and empty states", () => {
  it("shows nothing when everything is fine", () => {
    expect(renderToStaticMarkup(<StatusBanners view={view({})} />)).toBe("");
  });
  it("data older than 8 days gets a 'Last updated N days ago' banner", () => {
    expect(renderToStaticMarkup(<StatusBanners view={view({ daysOld: 9 })} />)).toContain("Last updated 9 days ago");
    expect(renderToStaticMarkup(<StatusBanners view={view({ daysOld: 8 })} />)).toBe("");
  });
  it("all search providers failing says live search is unavailable and shows stored data", () => {
    const html = renderToStaticMarkup(<StatusBanners view={view({ searchUnavailable: true })} />);
    expect(html).toContain("Live search is unavailable");
    expect(html).toContain("Showing stored data from");
  });
  it("a partly finished run tells the user to press Refresh again", () => {
    const html = renderToStaticMarkup(<StatusBanners view={view({ partialRun: true })} />);
    expect(html).toContain("Some articles are still waiting");
    expect(html).toContain("Press Refresh again to continue.");
  });
  it("a failed request shows a plain message and a Retry button, never raw error text", () => {
    const html = renderToStaticMarkup(<ErrorRetry onRetry={() => {}} />);
    expect(html).toContain("Retry");
    expect(html).toContain("We could not load this just now.");
  });
  it("empty and banner components render their text", () => {
    expect(renderToStaticMarkup(<EmptyState title="No digest has been built yet">x</EmptyState>)).toContain("No digest has been built yet");
    expect(renderToStaticMarkup(<Banner tone="error" title="t">m</Banner>)).toContain('role="alert"');
  });
});
