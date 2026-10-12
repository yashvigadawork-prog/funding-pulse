"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * An info icon that opens a small card on hover, keyboard focus or tap. It replaces the old "What is this?" links:
 * the explanation text is the same, it just lives in a tooltip.
 */
export function InfoTip({
  label,
  children,
  className,
  side = "bottom",
  width = "w-80",
  trigger,
}: {
  label: string;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  width?: string;
  /** Replace the little info icon with your own trigger content (for example a whole line of text). */
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        openOnHover
        delay={120}
        closeDelay={120}
        aria-label={label}
        className={cn(
          trigger
            ? "inline-flex shrink-0 items-center gap-1.5 rounded-md px-1 py-0.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted"
            : "inline-grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted data-popup-open:text-foreground",
          className,
        )}
      >
        {trigger ?? <Info className="size-3.5" aria-hidden />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side={side} sideOffset={8} collisionPadding={12} className="isolate z-[70]">
          <Popover.Popup
            className={cn(
              "max-h-[min(70vh,34rem)] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border bg-popover p-3.5 text-sm text-popover-foreground shadow-lg outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
              width,
            )}
          >
            {typeof children === "function" ? children(() => setOpen(false)) : children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
