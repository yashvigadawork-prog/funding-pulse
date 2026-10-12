"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type TabId = "brief" | "market" | "actions";
export const TABS: { id: TabId; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "market", label: "Market" },
  { id: "actions", label: "Actions" },
];

export function parseTab(v: string | null): TabId {
  return v === "market" || v === "actions" ? v : "brief";
}

interface Nav {
  tab: TabId;
  week: string | null;
  /** Link for a tab, keeping the chosen week. */
  href: (tab: TabId) => string;
  setTab: (tab: TabId) => void;
  setWeek: (week: string) => void;
  /** Go to a tab, then scroll to an element in it once it has appeared. */
  jump: (tab: TabId, id: string, opts?: { expand?: string }) => void;
  expanded: string | null;
}

const Ctx = createContext<Nav | null>(null);
export const useNav = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNav needs <NavProvider>");
  return v;
};

function scrollToId(id: string) {
  let tries = 0;
  const tick = () => {
    const el = document.getElementById(id);
    if (el) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    } else if (tries++ < 20) window.setTimeout(tick, 60);
  };
  window.setTimeout(tick, 80);
}

export function NavProvider({ children, expanded, setExpanded }: { children: React.ReactNode; expanded: string | null; setExpanded: (v: string | null) => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const tab = parseTab(params.get("tab"));
  const week = params.get("week");

  const build = useCallback(
    (t: TabId, w: string | null) => {
      const q = new URLSearchParams();
      if (t !== "brief") q.set("tab", t);
      if (w) q.set("week", w);
      const s = q.toString();
      return s ? `/?${s}` : "/";
    },
    [],
  );

  const value = useMemo<Nav>(
    () => ({
      tab,
      week,
      expanded,
      href: (t) => build(t, week),
      setTab: (t) => {
        if (t !== tab) router.push(build(t, week), { scroll: false });
      },
      setWeek: (w) => router.replace(build(tab, w), { scroll: false }),
      jump: (t, id, opts) => {
        if (opts?.expand) setExpanded(opts.expand);
        if (t !== tab) router.push(build(t, week), { scroll: false });
        scrollToId(id);
      },
    }),
    [tab, week, expanded, build, router, setExpanded],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
