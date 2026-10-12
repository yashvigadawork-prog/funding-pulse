"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, RefreshCw, TriangleAlert, X } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError, fetcher } from "@/lib/client/api";
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
      finished.current();
    }
  }, [data?.running]);

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
  const rows = r.status?.steps ?? [];
  if (!r.panelOpen) return null;
  const stages = STAGES.map((s, i) => ({ ...s, ...stageStatus(rows, s.steps, i === STAGES.length - 1, r.running) }));
  return (
    <section aria-label="Refresh progress" className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{r.running ? "Refreshing now…" : "Last refresh"}</h2>
        {!r.running ? (
          <Button variant="ghost" size="icon-sm" aria-label="Hide refresh progress" onClick={r.hide}>
            <X />
          </Button>
        ) : null}
      </div>
      <ol className="mt-2 grid gap-2 md:grid-cols-5" aria-live="polite">
        {stages.map((s) => (
          <li key={`${s.key}-${s.status}`} className={cn("rounded-lg border px-3 py-2 text-sm", s.status === "running" && "border-primary/50 bg-primary/5", s.status !== "pending" && "fp-new-row")}>
            <div className="flex items-center gap-2 font-medium">
              <StageIcon status={s.status} />
              {s.label}
            </div>
            {s.message ? <p className="mt-1 line-clamp-4 text-xs text-muted-foreground">{s.message}</p> : null}
            <span className="sr-only">{s.status}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "running") return <Loader2 className="size-4 animate-spin text-primary" aria-hidden />;
  if (status === "ok") return <Check className="size-4 text-positive-ink" aria-hidden />;
  if (status === "partial" || status === "error") return <TriangleAlert className={cn("size-4", status === "error" ? "text-destructive" : "text-warning-ink")} aria-hidden />;
  if (status === "skipped") return <span className="size-4 text-center text-muted-foreground" aria-hidden>–</span>;
  return <span className="size-3 rounded-full border-2 border-muted-foreground/40" aria-hidden />;
}
