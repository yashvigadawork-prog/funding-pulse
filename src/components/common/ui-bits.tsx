"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function NativeSelect({
  id,
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Type a word and press Enter or comma to add it. Click x to remove. */
export function ChipsInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  function commit(raw: string) {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft("");
  }
  return (
    <div className="grid gap-1.5">
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-md bg-secondary py-0.5 pr-0.5 pl-2 text-xs text-secondary-foreground">
              {v}
              <button
                type="button"
                className="grid size-5 place-items-center rounded hover:bg-background/60"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(value.filter((x) => x !== v))}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        id={id}
        value={draft}
        placeholder={placeholder ?? "Type and press Enter"}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(draft);
          }
        }}
        onBlur={() => commit(draft)}
      />
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SaveBar({
  onSave,
  saving,
  savedAt,
  error,
  label = "Save changes",
  disabled,
}: {
  onSave: () => void;
  saving: boolean;
  savedAt: Date | null;
  error?: string | null;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3" aria-live="polite">
      <Button onClick={onSave} disabled={saving || disabled} size="sm">
        {saving ? "Saving…" : label}
      </Button>
      {savedAt && !error ? (
        <span className="text-xs font-medium text-positive-ink">
          Saved at {savedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}. It applies from the next run.
        </span>
      ) : null}
      {error ? <span className="text-xs font-medium text-destructive">{error}</span> : null}
    </div>
  );
}

export function CompanyLogo({ name, domain, size = 28 }: { name: string; domain?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const box = { width: size, height: size };
  if (!domain || failed) {
    return (
      <span
        aria-hidden
        style={box}
        className="grid shrink-0 place-items-center rounded-md bg-accent text-[0.65rem] font-semibold text-accent-foreground"
      >
        {initials || "?"}
      </span>
    );
  }
  return (
    // Favicons come from the company's own domain; plain img keeps the fallback simple.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
      alt=""
      aria-hidden
      loading="lazy"
      style={box}
      className="shrink-0 rounded-md bg-white object-contain p-0.5 ring-1 ring-border"
      onError={() => setFailed(true)}
    />
  );
}

export function TagBadge({ tag }: { tag: string }) {
  const radar = tag === "On Radar";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[0.68rem] font-medium leading-none",
        radar ? "bg-warning/15 text-warning-ink ring-1 ring-warning/30" : "bg-primary/10 text-primary ring-1 ring-primary/25",
      )}
    >
      {tag}
    </span>
  );
}

export const SECTOR_VAR: Record<string, string> = {
  Fintech: "var(--sector-fintech)",
  "Health & wellness": "var(--sector-health)",
  "Climate & sustainability": "var(--sector-climate)",
  "Media, deeptech & education": "var(--sector-media)",
  Other: "var(--sector-other)",
};

export function SectorDot({ sector, className }: { sector: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: SECTOR_VAR[sector] ?? "var(--sector-other)" }}
    />
  );
}
