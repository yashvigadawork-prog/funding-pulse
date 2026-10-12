"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, TriangleAlert, X } from "lucide-react";
import { motion } from "motion/react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError, fetcher } from "@/lib/client/api";
import { usePrefersReducedMotion } from "@/lib/client/hooks";
import { cn } from "@/lib/utils";

export interface StatusResponse {
  runId: string | null;
  running: boolean;
  steps: { id: number; step: string; status: string; kind: string; message: string | null; startedAt: string; finishedAt: string | null }[];
  cooldownSec: number;
  lastCollect: { at: string; total: number; reachable: number; unreachable: string[] } | null;
  lastRun: { at: string; partial?: boolean } | null;
}

const STAGES = [
  { key: "collect", label: "Collecting", steps: ["collect"] },
  { key: "extract", label: "Extracting", steps: ["extract"] },
  { key: "process", label: "Matching", steps: ["process"] },
  { key: "analyse", label: "Analysing", steps: ["compute", "analyse", "store", "send"] },
  { key: "done", label: "Done", steps: ["done"] },
] as const;

type StageStatus = "pending" | "running" | "ok" | "partial" | "error" | "skipped";

function stageStatus(rows: StatusResponse["steps"], stepNames: readonly string[], isLast: boolean, running: boolean): { status: StageStatus; message: string | null } {
  const mine = rows.filter((r) => stepNames.includes(r.step));
  if (!mine.length) return { status: "pending", message: null };
  const err = mine.find((r) => r.status === "error");
  if (err) return { status: "error", message: err.message };
  const run = mine.find((r) => r.status === "running");
  if (run) return { status: "running", message: run.message };
  const last = mine[mine.length - 1];
  if (!isLast && running && last.step !== stepNames[stepNames.length - 1]) return { status: "running", message: last.message };
  const part = mine.find((r) => r.status === "partial");
  return { status: part ? "partial" : last.status === "skipped" ? "skipped" : "ok", message: mine.map((r) => r.message).filter(Boolean).join(" ") || null };
}

export function useRefresh(onFinished: () => void) {
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startedHere, setStartedHere] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const { data, mutate } = useSWR<StatusResponse>(`/api/pipeline/status${runId ? `?run=${runId}` : ""}`, fetcher, {
    refreshInterval: (d) => (d?.running ? 2000 : 0),
    revalidateOnFocus: true,
  });
  const wasRunning = useRef(false);
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  }, [onFinished]);

  // When a run ends, reload the dashboard once.
  useEffect(() => {
    if (data?.running) {
      wasRunning.current = true;
    } else if (wasRunning.current) {
      wasRunning.current = false;
      const n = data?.steps.find((x) => x.step === "process")?.message?.match(/(\d+) new deals?/)?.[1];
      toast.success(n !== undefined ? `Refreshed: ${n} new ${n === "1" ? "deal" : "deals"}` : "Refreshed");
      finished.current();
    }
  }, [data?.running, data?.steps]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const r = await api.post<{ runId: string }>("/api/pipeline/refresh");
      setRunId(r.runId);
      setStartedHere(true);
      wasRunning.current = true;
      await mutate();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const id = (e.body?.runId as string | undefined) ?? null;
        if (id) setRunId(id);
        setStartedHere(true);
        await mutate();
        toast.info("A refresh is already running. Showing its progress.");
      } else {
        toast.error(e instanceof ApiError ? e.message : "Could not start a refresh.");
        await mutate();
      }
    } finally {
      setStarting(false);
    }
  }, [mutate]);

  const running = !!data?.running;
  const panelOpen = running || (startedHere && !!data?.runId && dismissed !== data.runId);
  const hide = () => setDismissed(data?.runId ?? null);
  return { status: data ?? null, start, starting, panelOpen, hide, running };
}

export function RefreshButton({ r, compact }: { r: ReturnType<typeof useRefresh>; compact?: boolean }) {
  const cooling = !r.running && (r.status?.cooldownSec ?? 0) > 0;
  const mins = Math.ceil((r.status?.cooldownSec ?? 0) / 60);
  return (
    <div className="flex flex-col items-start">
      <Button onClick={r.start} disabled={r.starting || r.running || cooling} aria-describedby={cooling ? "cooldown-note" : undefined}>
        {r.running || r.starting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
        <span className={compact ? "sr-only sm:not-sr-only" : ""}>{r.running ? "Refreshing…" : "Refresh now"}</span>
      </Button>
      {cooling ? (
        <span id="cooldown-note" className="mt-1 text-xs text-muted-foreground">
          Cooling down: try again in {mins} minute{mins === 1 ? "" : "s"}.
        </span>
      ) : null}
    </div>
  );
}

export function RefreshStepper({ r }: { r: ReturnType<typeof useRefresh> }) {
  const reduced = usePrefersReducedMotion();
  const rows = r.status?.steps ?? [];
  if (!r.panelOpen) return null;
  const stages = STAGES.map((s, i) => ({ ...s, ...stageStatus(rows, s.steps, i === STAGES.length - 1, r.running) }));
  const finished = (st: StageStatus) => st === "ok" || st === "skipped" || st === "partial";
  // How far the connector line is filled: every finished step, plus half a step toward the one that is running.
  const done = stages.filter((x) => finished(x.status)).length;
  const running = stages.some((x) => x.status === "running");
  const fill = Math.min(100, (Math.max(0, done - 1) + (running ? 0.5 : 0)) / (stages.length - 1) * 100);
  return (
    <section aria-label="Refresh progress" className="rounded-[16px] border bg-card px-4 py-4 md:px-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{r.running ? "Refreshing now…" : "Last refresh"}</h2>
        {!r.running ? (
          <Button variant="ghost" size="icon-sm" aria-label="Hide refresh progress" onClick={r.hide}>
            <X />
          </Button>
        ) : null}
      </div>
      <ol className="relative mt-3 grid gap-4 md:grid-cols-5 md:gap-2" aria-live="polite">
        <div aria-hidden className="absolute top-[17px] right-[10%] left-[10%] hidden h-0.5 rounded-full bg-border md:block">
          <motion.div className="h-full origin-left rounded-full bg-primary" initial={false} animate={{ width: `${fill}%` }} transition={{ duration: reduced ? 0 : 0.7, ease: "easeOut" }} />
        </div>
        {stages.map((s) => (
          <li key={`${s.key}-${s.status}`} className={cn("relative flex gap-3 rounded-lg md:flex-col md:items-center md:gap-2 md:text-center", s.status !== "pending" && "fp-new-row")}>
            <span className={cn("relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 bg-card transition-colors", s.status === "running" && "border-primary", finished(s.status) && s.status !== "partial" && "border-positive bg-positive-soft", s.status === "partial" && "border-warning bg-warning-soft", s.status === "error" && "border-destructive", s.status === "pending" && "border-border")}>
              {s.status === "running" ? <span aria-hidden className="fp-step-pulse absolute inset-0 rounded-full" /> : null}
              <StageIcon status={s.status} reduced={reduced} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{s.label}</span>
              {s.message ? <span className="mt-0.5 line-clamp-3 block text-xs text-muted-foreground">{s.message}</span> : null}
              <span className="sr-only">{s.status}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StageIcon({ status, reduced }: { status: StageStatus; reduced: boolean }) {
  if (status === "running") return <Loader2 className="relative size-4 animate-spin text-primary" aria-hidden />;
  if (status === "ok")
    return (
      <svg viewBox="0 0 24 24" className="size-4 text-positive-ink" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease: "easeOut" }} />
      </svg>
    );
  if (status === "partial" || status === "error") return <TriangleAlert className={cn("size-4", status === "error" ? "text-destructive" : "text-warning-ink")} aria-hidden />;
  if (status === "skipped") return <span className="text-center text-sm text-muted-foreground" aria-hidden>–</span>;
  return <span className="size-2 rounded-full bg-muted-foreground/40" aria-hidden />;
}
