"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCountUp, usePrefersReducedMotion } from "@/lib/client/hooks";
import { cn } from "@/lib/utils";

/** A headline that appears word by word: each word rises and un-blurs (40 ms apart). Final text is shown at once with reduced motion. */
export function WordReveal({ text, className, italicFrom }: { text: string; className?: string; italicFrom?: number }) {
  const reduced = usePrefersReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);
  if (reduced) {
    return (
      <span className={className}>
        {words.map((w, i) => (
          <span key={i} className={cn(italicFrom !== undefined && i >= italicFrom && "italic text-warning-ink")}>
            {w}{" "}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <motion.span
          key={`${text}-${i}`}
          aria-hidden
          className={cn("inline-block", italicFrom !== undefined && i >= italicFrom && "italic text-warning-ink")}
          initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, delay: 0.1 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}

/** A number that counts up with tabular figures, so the width does not jump. */
export function CountNumber({ value, format = (n: number) => String(Math.round(n)), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const v = useCountUp(value);
  return <span className={cn("fig", className)}>{format(v)}</span>;
}

/** Text that rolls up from below when it changes (for the Top sector tile). */
export function RollText({ text, className }: { text: string; className?: string }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <span className={className}>{text}</span>;
  return (
    <span className={cn("relative block overflow-hidden", className)}>
      <AnimatePresence mode="popLayout" initial>
        <motion.span key={text} className="block" initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "-100%", opacity: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Fade up 8 px, used for cards. `index` staggers siblings by 40 ms. */
export function Rise({ children, index = 0, className, as = "div", id }: { children: React.ReactNode; index?: number; className?: string; as?: "div" | "li" | "section" | "article"; id?: string }) {
  const reduced = usePrefersReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  if (reduced) return <Comp id={id} className={className}>{children}</Comp>;
  return (
    <Comp id={id} className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </Comp>
  );
}

/** Height-animated disclosure used by "See all" and "Read the analysis". */
export function Collapse({ open, children, className }: { open: boolean; children: React.ReactNode; className?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="c"
          className={cn("overflow-hidden", className)}
          initial={reduced ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
