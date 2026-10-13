"use client";

import { useEffect, useState } from "react";
import { Eye, FileDown, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deckUrl } from "@/lib/deck/url";
import { DEFAULT_DECK_SECTIONS, type DeckSectionId } from "@/lib/deck/sections";
import { formatWeekRange } from "@/lib/time";
import { loadSavedSections, saveSections, SectionPicker } from "./section-picker";

/** "Download PDF": tick the sections, then build the summary deck. */
export function DeckDialog({ week, open, onOpenChange }: { week: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [sections, setSections] = useState<DeckSectionId[]>(DEFAULT_DECK_SECTIONS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Remembered choice, read once the dialog opens (never during the first server render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setSections(loadSavedSections());
  }, [open]);

  const change = (v: DeckSectionId[]) => {
    setSections(v);
    saveSections(v);
  };

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(deckUrl(week, sections, { download: true }));
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "The deck could not be built just now. Press Preview, then Save as PDF, to get it another way.");
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "Funding-Pulse.pdf";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success("Your summary deck is ready.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The deck could not be built just now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Summary deck</DialogTitle>
          <DialogDescription>A short slide deck for the week of {formatWeekRange(week)}. Tick what to include. The cover is always added.</DialogDescription>
        </DialogHeader>
        <div className="-mr-1 max-h-[48dvh] overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible">
          <SectionPicker value={sections} onChange={change} />
        </div>
        <DialogFooter className="gap-2 sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" nativeButton={false} render={<a href={`/report/${week}?print=1`} target="_blank" rel="noopener noreferrer" />}>
            <Printer data-icon="inline-start" /> Print the full report instead
          </Button>
          <span className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!sections.length || busy} nativeButton={false} render={<a href={deckUrl(week, sections, { preview: true })} target="_blank" rel="noopener noreferrer" />}>
              <Eye data-icon="inline-start" /> Preview
            </Button>
            <Button onClick={download} disabled={!sections.length || busy}>
              {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <FileDown data-icon="inline-start" />} {busy ? "Building…" : "Download PDF"}
            </Button>
          </span>
        </DialogFooter>
        {busy ? <p className="text-xs text-muted-foreground">Building your deck. This usually takes about ten seconds.</p> : null}
      </DialogContent>
    </Dialog>
  );
}
