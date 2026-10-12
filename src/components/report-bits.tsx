"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the print dialog once when the page is opened with ?print=1. */
export function PrintTrigger({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => window.print(), 900); // give charts a moment to draw
    return () => window.clearTimeout(t);
  }, [auto]);
  return (
    <Button onClick={() => window.print()} className="no-print">
      <Printer data-icon="inline-start" /> Print or save as PDF
    </Button>
  );
}
