"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const subscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";

  function toggle() {
    const root = document.documentElement;
    root.classList.add("theme-fade"); // short crossfade, removed again below
    setTheme(dark ? "light" : "dark");
    window.setTimeout(() => root.classList.remove("theme-fade"), 260);
  }

  return (
    <Button variant="outline" size="icon" className="size-9 rounded-full bg-card" onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      {mounted ? dark ? <Sun /> : <Moon /> : <Sun className="opacity-0" />}
    </Button>
  );
}
