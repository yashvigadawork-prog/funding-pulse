"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { animate } from "motion/react";

const noopSubscribe = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

/**
 * Counts to `value` over about a second with ease-out. On first load it starts at 0; when the value changes
 * (a different week) it counts from the number that was on screen. With reduced motion it shows the number at once.
 */
export function useCountUp(value: number, durationMs = 1000): number {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(0);
  const last = useRef(0);
  useEffect(() => {
    if (reduced) return; // the number is returned directly below
    const controls = animate(last.current, value, {
      duration: durationMs / 1000,
      ease: "easeOut",
      onUpdate: (v) => {
        last.current = v;
        setShown(v);
      },
    });
    // Safety net: a tab that is not drawing frames must still end on the true number.
    const settle = window.setTimeout(() => {
      last.current = value;
      setShown(value);
    }, durationMs + 250);
    return () => {
      controls.stop();
      window.clearTimeout(settle);
    };
  }, [value, reduced, durationMs]);
  return reduced ? value : shown;
}
