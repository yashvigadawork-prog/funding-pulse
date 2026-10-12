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

/** Counts up to `value` once on load (about 600 ms). With reduced motion it shows the final number straight away. */
export function useCountUp(value: number, durationMs = 600): number {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const done = useRef(false);
  useEffect(() => {
    if (reduced || done.current) {
      setShown(value);
      return;
    }
    done.current = true;
    const controls = animate(0, value, { duration: durationMs / 1000, ease: "easeOut", onUpdate: (v) => setShown(v) });
    return () => controls.stop();
  }, [value, reduced, durationMs]);
  return shown;
}
