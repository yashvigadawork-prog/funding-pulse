"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { Banner, DashboardSkeleton, EmptyState, ErrorRetry } from "@/components/common/states";
import { fetcher } from "@/lib/client/api";
import { formatWeekRange } from "@/lib/time";
import type { DealRowView, DigestView } from "@/lib/view-types";
import { AskDrawer } from "./ask-drawer";
import { ComposeDrawer, type ComposeRequest } from "./compose-drawer";
import { DealDrawer } from "./deal-drawer";
import { KpiStrip, QualityStrip, StatusBanners } from "./kpis";
import { RefreshButton, RefreshStepper, useRefresh } from "./refresh";
import { Section1 } from "./section1";
import { Section2 } from "./section2";
import { Section3 } from "./section3";

export function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const week = params.get("week");
  const { data, error, isLoading, mutate } = useSWR<DigestView>(`/api/digest${week ? `?week=${week}` : ""}`, fetcher, { revalidateOnFocus: false });
  const reload = useCallback(() => void mutate(), [mutate]);
  const refresh = useRefresh(reload);
  const [deal, setDeal] = useState<DealRowView | null>(null);
  const [compose, setCompose] = useState<ComposeRequest | null>(null);

  const header = (
    <TopBar
      weeks={data?.weeks}
      defaultWeek={data?.defaultWeek}
      week={data?.week}
      onWeekChange={(w) => router.replace(`/?week=${w}`)}
      refresh={refresh}
    />
  );

  let body: React.ReactNode;
  if (error && !data) body = <div className="mx-auto max-w-2xl px-4 py-10"><ErrorRetry message={error instanceof Error ? error.message : undefined} onRetry={reload} /></div>;
  else if (isLoading || !data) body = <DashboardSkeleton />;
  else if (!data.weeks.length || !data.digest)
    body = (
      <div className="mx-auto max-w-2xl px-4 py-10 grid gap-4">
        <RefreshStepper r={refresh} />
        <EmptyState title="No digest has been built yet" action={<RefreshButton r={refresh} />}>
          Press Refresh now to collect this week&rsquo;s funding news. It takes a few minutes and you can watch the progress here.
        </EmptyState>
      </div>
    );
  else {
    const noDeals = data.deals.length === 0;
    body = (
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Funding Pulse</h1>
          <p className="text-sm text-muted-foreground">
            Week of {formatWeekRange(data.week!)}. {data.digest.emailedAt ? "Emailed to the digest list." : ""}
          </p>
        </div>
        <RefreshStepper r={refresh} />
        <StatusBanners view={data} />
        <KpiStrip view={data} />
        <QualityStrip view={data} />
        {noDeals ? (
          <EmptyState title="No deals were recorded for this week">
            Either nothing was announced, or this week has not been collected yet. Check the data quality line above, then try Refresh now or pick another week.
          </EmptyState>
        ) : (
          <>
            <Section1 view={data} onOpenDeal={setDeal} />
            <Section2 view={data} onOpenDeal={setDeal} />
          </>
        )}
        <Section3 view={data} onCompose={setCompose} />
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm text-muted-foreground no-print">
          <span>Every claim links to its source. Amounts that were not disclosed are never guessed or added up.</span>
          <Button variant="link" size="sm" nativeButton={false} render={<Link href="/method" />}>
            Method and checks
          </Button>
        </footer>
      </div>
    );
  }
  return (
    <AppShell header={header}>
      {error && data ? (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <Banner tone="warn" title="Could not refresh the page">
            Showing what was loaded earlier. <button className="underline" onClick={reload}>Retry</button>
          </Banner>
        </div>
      ) : null}
      {body}
      <DealDrawer deal={deal} onClose={() => setDeal(null)} />
      <ComposeDrawer request={compose} onClose={() => setCompose(null)} />
      <AskDrawer />
    </AppShell>
  );
}
