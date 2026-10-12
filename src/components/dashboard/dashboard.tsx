"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { LayoutGrid, ListChecks, MessageCircleQuestion, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { Banner, DashboardSkeleton, EmptyState, ErrorRetry } from "@/components/common/states";
import { BriefTab } from "@/components/brief/brief";
import { FocusDrawer, NamesDrawer } from "@/components/brief/drawers";
import { MarketTab } from "@/components/market/market";
import { ActionsTab } from "@/components/actions/actions";
import { fetcher } from "@/lib/client/api";
import { formatWeekRange } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { ActionsBlock } from "@/lib/actions/types";
import type { DealRowView, DigestView } from "@/lib/view-types";
import { AskDrawer } from "./ask-drawer";
import { StatusBanners } from "./banners";
import { ComposeDrawer, type ComposeRequest } from "./compose-drawer";
import { DataStrip } from "./data-strip";
import { DealDrawer } from "./deal-drawer";
import { NavProvider, TABS, useNav, type TabId } from "./nav";
import { RefreshButton, RefreshStepper, useRefresh } from "./refresh";
import { usePrefersReducedMotion } from "@/lib/client/hooks";

const TAB_ICON: Record<TabId, typeof Sparkles> = { brief: Sparkles, market: LayoutGrid, actions: ListChecks };

function BottomBar({ onAsk, actionsCount }: { onAsk: () => void; actionsCount: number }) {
  const nav = useNav();
  const item = "relative flex h-14 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <nav aria-label="Sections" className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-md items-stretch gap-1 px-2 py-1">
        {TABS.map((t) => {
          const Icon = TAB_ICON[t.id];
          const active = nav.tab === t.id;
          return (
            <Link key={t.id} href={nav.href(t.id)} scroll={false} aria-current={active ? "page" : undefined} className={cn(item, active ? "text-primary" : "text-muted-foreground")}>
              <motion.span whileTap={{ scale: 1.25, y: -3 }} transition={{ type: "spring", stiffness: 500, damping: 12 }} className="relative">
                <Icon className="size-5" aria-hidden />
                {t.id === "actions" && actionsCount ? <span className="fig absolute -top-1 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{actionsCount}</span> : null}
              </motion.span>
              {t.label}
              {active ? <motion.span layoutId="bottom-pill" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary" /> : null}
            </Link>
          );
        })}
        <button type="button" onClick={onAsk} className={cn(item, "text-muted-foreground")}>
          <motion.span whileTap={{ scale: 1.25, y: -3 }} transition={{ type: "spring", stiffness: 500, damping: 12 }}>
            <MessageCircleQuestion className="size-5" aria-hidden />
          </motion.span>
          Ask
        </button>
      </div>
    </nav>
  );
}

function Inner() {
  const nav = useNav();
  const reduced = usePrefersReducedMotion();
  const week = nav.week;
  const { data, error, isLoading, mutate } = useSWR<DigestView>(`/api/digest${week ? `?week=${week}` : ""}`, fetcher, { revalidateOnFocus: false });
  const reload = useCallback(() => void mutate(), [mutate]);
  const refresh = useRefresh(reload);
  const [deal, setDeal] = useState<DealRowView | null>(null);
  const [compose, setCompose] = useState<ComposeRequest | null>(null);
  const [ask, setAsk] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [namesOpen, setNamesOpen] = useState(false);
  const actions = data?.digest?.actions as Partial<ActionsBlock> | undefined;
  const actionsCount = actions?.founderOutreach ? (actions.founderOutreach.length || 0) + (actions.portfolioFollowUp?.length || 0) + (actions.lpBrief ? 1 : 0) : 0;
  const router = useRouter();

  const header = (
    <>
      <TopBar weeks={data?.weeks} defaultWeek={data?.defaultWeek} week={data?.week} refresh={refresh} actionsCount={actionsCount} />
      {data?.digest ? <DataStrip view={data} /> : null}
    </>
  );

  let body: React.ReactNode;
  if (error && !data)
    body = (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorRetry message={error instanceof Error ? error.message : undefined} onRetry={reload} />
      </div>
    );
  else if (isLoading || !data) body = <DashboardSkeleton />;
  else if (data.weeks.length > 0 && !data.digest)
    body = (
      <div className="mx-auto grid max-w-2xl gap-4 px-4 py-10">
        <EmptyState title="No digest for this week" action={<Button onClick={() => router.replace("/")}>Go to the latest digest</Button>}>
          Nothing has been collected for the week of {data.week ? formatWeekRange(data.week) : "this date"}. Pick another week from the list at the top, or open the latest one.
        </EmptyState>
      </div>
    );
  else if (!data.weeks.length || !data.digest)
    body = (
      <div className="mx-auto grid max-w-2xl gap-4 px-4 py-10">
        <RefreshStepper r={refresh} />
        <EmptyState title="No digest has been built yet" action={<RefreshButton r={refresh} />}>
          Press Refresh now to collect this week&rsquo;s funding news. It takes a few minutes and you can watch the progress here.
        </EmptyState>
      </div>
    );
  else {
    body = (
      <div className="mx-auto grid max-w-[88rem] grid-cols-[minmax(0,1fr)] gap-5 px-4 py-5 md:px-6 md:py-6">
        <RefreshStepper r={refresh} />
        <StatusBanners view={data} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={nav.tab}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25, ease: "easeOut" }}
          >
            {nav.tab === "brief" ? (
              data.deals.length ? (
                <BriefTab view={data} onOpenDeal={setDeal} onOpenFocus={() => setFocusOpen(true)} onSeeAllNames={() => setNamesOpen(true)} />
              ) : (
                <EmptyState title="No deals were recorded for this week">Either nothing was announced, or this week has not been collected yet. Check the data line above, then try Refresh now or pick another week.</EmptyState>
              )
            ) : nav.tab === "market" ? (
              <MarketTab view={data} onOpenDeal={setDeal} />
            ) : (
              <ActionsTab view={data} onCompose={setCompose} />
            )}
          </motion.div>
        </AnimatePresence>
        <FocusDrawer view={data} open={focusOpen} onClose={() => setFocusOpen(false)} onOpenDeal={(d) => { setFocusOpen(false); setDeal(d); }} />
        <NamesDrawer view={data} open={namesOpen} onClose={() => setNamesOpen(false)} onOpenDeal={(d) => { setNamesOpen(false); setDeal(d); }} />
      </div>
    );
  }

  const footer = (
    <footer className="no-print mx-auto mt-2 flex w-full max-w-[88rem] flex-wrap items-center justify-between gap-2 border-t px-4 py-4 pb-24 text-sm text-muted-foreground md:px-6 md:pb-6">
      <span>Every claim links to its source. Amounts that were not disclosed are never guessed or added up.</span>
      <Button variant="link" size="sm" nativeButton={false} render={<Link href="/method" />}>
        Method and checks
      </Button>
    </footer>
  );

  return (
    <AppShell header={header} footer={footer}>
      {error && data ? (
        <div className="mx-auto max-w-[88rem] px-4 pt-4 md:px-6">
          <Banner tone="warn" title="Could not refresh the page">
            Showing what was loaded earlier. <button className="underline" onClick={reload}>Retry</button>
          </Banner>
        </div>
      ) : null}
      {body}
      <DealDrawer deal={deal} onClose={() => setDeal(null)} />
      <ComposeDrawer request={compose} onClose={() => setCompose(null)} />
      <AskDrawer open={ask} onOpenChange={setAsk} />
      <Button className="no-print fixed right-5 bottom-5 z-30 hidden rounded-full shadow-lg md:inline-flex" size="lg" onClick={() => setAsk(true)}>
        <MessageCircleQuestion data-icon="inline-start" /> Ask
      </Button>
      <BottomBar onAsk={() => setAsk(true)} actionsCount={actionsCount} />
    </AppShell>
  );
}

export function Dashboard() {
  const [expanded, setExpanded] = useState<string | null>(null);
  // useSearchParams needs the page's Suspense boundary, which app/page.tsx provides.
  useSearchParams();
  return (
    <NavProvider expanded={expanded} setExpanded={setExpanded}>
      <Inner />
    </NavProvider>
  );
}
