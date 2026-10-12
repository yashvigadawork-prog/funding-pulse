"use client";

import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/client/hooks";

/**
 * A small trend line drawn from real stored weekly totals. It is only shown when at least three weeks exist,
 * and it never draws anything that was not stored.
 */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const reduced = usePrefersReducedMotion();
  if (values.length < 3) return null;
  const w = 76;
  const h = 26;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * (w - 4), h - 3 - ((v - min) / span) * (h - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible text-primary">
      <motion.path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0, opacity: 0.3 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.circle cx={last[0]} cy={last[1]} r={2.6} fill="currentColor" initial={reduced ? false : { opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.7, type: "spring", stiffness: 400, damping: 15 }} />
    </svg>
  );
}
