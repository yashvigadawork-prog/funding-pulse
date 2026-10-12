"use client";

import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Skeleton blocks use the shimmer animation, which switches off for reduced motion. */
export function Shimmer({ className }: { className?: string }) {
  return <div aria-hidden className={cn("fp-shimmer rounded-lg", className)} />;
}

export function Banner({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warn" | "error";
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        tone === "info" && "border-primary/25 bg-primary/5",
        tone === "warn" && "border-warning/40 bg-warning/10",
        tone === "error" && "border-destructive/40 bg-destructive/10",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "info" && "text-primary", tone === "warn" && "text-warning-ink", tone === "error" && "text-destructive")} aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5 text-muted-foreground" : ""}>{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      {icon}
      <p className="text-base font-medium">{title}</p>
      {children ? <div className="max-w-md text-sm text-muted-foreground">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** A failed request: a short message and a Retry button, never raw error text. */
export function ErrorRetry({ message, onRetry, busy }: { message?: string; onRetry: () => void; busy?: boolean }) {
  return (
    <div role="alert" className="grid place-items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center">
      <AlertTriangle className="size-6 text-destructive" aria-hidden />
      <p className="font-medium">We could not load this just now.</p>
      <p className="max-w-md text-sm text-muted-foreground">{message ?? "Please check your connection and try again."}</p>
      <Button variant="outline" onClick={onRetry} disabled={busy}>
        <RefreshCw data-icon="inline-start" /> {busy ? "Trying…" : "Retry"}
      </Button>
    </div>
  );
}

/** Loading shapes that match the real Brief: a hero card with five tiles, then a bento of cards. */
export function DashboardSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6" aria-busy="true" aria-label="Loading the dashboard">
      <Shimmer className="h-9 w-2/3 rounded-[16px]" />
      <Shimmer className="h-6 w-1/2 rounded-[16px]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="h-24 rounded-[16px]" />
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-6">
        <Shimmer className="h-64 rounded-[16px] md:col-span-4" />
        <Shimmer className="h-64 rounded-[16px] md:col-span-2" />
        <Shimmer className="h-52 rounded-[16px] md:col-span-3" />
        <Shimmer className="h-52 rounded-[16px] md:col-span-3" />
      </div>
    </div>
  );
}
