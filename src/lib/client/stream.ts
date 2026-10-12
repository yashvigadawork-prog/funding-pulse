"use client";

/**
 * Shows new text appearing a few characters at a time, like it is being typed, then calls `done`.
 * With reduced motion the whole text appears at once. Returns a function that stops it early.
 */
export function streamText(full: string, set: (partial: string) => void, done?: () => void): () => void {
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || full.length < 20) {
    set(full);
    done?.();
    return () => {};
  }
  let i = 0;
  let stopped = false;
  const step = Math.max(3, Math.ceil(full.length / 120)); // about two seconds for any length
  const tick = () => {
    if (stopped) return;
    i = Math.min(full.length, i + step);
    set(full.slice(0, i));
    if (i < full.length) window.setTimeout(tick, 16);
    else done?.();
  };
  tick();
  return () => {
    stopped = true;
  };
}
