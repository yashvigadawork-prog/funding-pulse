"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const mq = window.matchMedia("(max-width: 767px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** True on a phone-width screen. Used to show three items per card instead of four or five. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia("(max-width: 767px)").matches, () => false);
}
