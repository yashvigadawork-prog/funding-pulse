"use client";

import type { LucideIcon } from "lucide-react";
import { Rise } from "@/components/common/motion-bits";
import { cn } from "@/lib/utils";

const TONES = {
  primary: "bg-accent text-accent-foreground",
  amber: "bg-warning-soft text-warning-ink",
  teal: "bg-positive-soft text-positive-ink",
  neutral: "bg-secondary text-ink-2",
} as const;

/** The shared card: a 16 px rounded box, thin border, and a tinted 32 px icon square before the title. */
export function BentoCard({
  id,
  icon: Icon,
  tone = "primary",
  title,
  action,
  children,
  className,
  index = 0,
}: {
  id?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <Rise as="section" id={id} index={index} className={cn("min-w-0 scroll-mt-32 rounded-2xl border bg-card p-4 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-ring/40 hover:shadow-[0_6px_24px_-16px_rgb(0_0_0/0.35)] md:p-5", className)}>
      <header className="mb-3 flex items-center gap-2.5">
        <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONES[tone])}>
          <Icon className="size-4" />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight">{title}</h2>
        {action}
      </header>
      {children}
    </Rise>
  );
}

/** A sector-coloured initials avatar. */
export function InitialsAvatar({ name, sectorVar, size = 32 }: { name: string; sectorVar: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, background: `color-mix(in oklch, ${sectorVar} 18%, transparent)`, color: "var(--foreground)", boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${sectorVar} 45%, transparent)` }}
      className="grid shrink-0 place-items-center rounded-full text-[11px] font-semibold"
    >
      {initials || "?"}
    </span>
  );
}

export function Chip({ tone = "neutral", children, className }: { tone?: "neutral" | "amber" | "teal" | "primary"; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-none font-medium",
        tone === "neutral" && "bg-secondary text-ink-2",
        tone === "amber" && "bg-warning-soft text-warning-ink",
        tone === "teal" && "bg-positive-soft text-positive-ink",
        tone === "primary" && "bg-accent text-accent-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SeeAll({ onClick, children = "See all", expanded }: { onClick: () => void; children?: React.ReactNode; expanded?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} className="group inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
      {children}
      <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
    </button>
  );
}
