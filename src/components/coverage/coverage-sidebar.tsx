"use client";

import { useRef, useState } from "react";
import { Briefcase, Download, Landmark, Radar, RotateCcw, SlidersHorizontal, Target, Upload, Users } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client/api";
import type { ConfigResponse } from "@/lib/client/types";
import { ConfirmDialog } from "@/components/common/ui-bits";
import { CompanyList } from "./company-list";
import { MandateTab } from "./mandate-tab";
import { InvestorsList, StakeholdersList } from "./people-lists";
import { SettingsForms } from "./settings-forms";
import { cn } from "@/lib/utils";

type Props = { config: ConfigResponse; onChanged: () => void };

function ConfigFooter({ onReplaced }: { onReplaced: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setImportError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setImportError("That file is not valid JSON. Please choose a file you exported from this app.");
      return;
    }
    try {
      const r = await api.post<{ portfolio: number; on_radar: number }>("/api/config/import", parsed);
      toast.success(`Imported ${r.portfolio} Portfolio and ${r.on_radar} On Radar companies`);
      onReplaced();
    } catch (e) {
      setImportError(e instanceof ApiError ? `Import rejected: ${e.message}` : "Import failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function reset() {
    setBusy(true);
    try {
      const r = await api.post<{ portfolio: number; on_radar: number }>("/api/config/reset");
      toast.success(`Reset done: ${r.portfolio} Portfolio and ${r.on_radar} On Radar companies restored`);
      setConfirmReset(false);
      onReplaced();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1.5 border-t bg-muted/30 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-auto text-xs font-medium text-muted-foreground">Backup</span>
        <Button variant="ghost" size="xs" nativeButton={false} render={<a href="/api/config/export" download />}>
          <Download data-icon="inline-start" /> Export config
        </Button>
        <Button variant="ghost" size="xs" onClick={() => fileRef.current?.click()}>
          <Upload data-icon="inline-start" /> Import config
        </Button>
        <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive" onClick={() => setConfirmReset(true)}>
          <RotateCcw data-icon="inline-start" /> Reset to defaults
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Choose a config file to import" onChange={(e) => onFile(e.target.files?.[0])} />
      {importError ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {importError}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset everything to the starting list?"
        description="This brings back the original Portfolio, On Radar, investors, contacts and settings. Your edits will be replaced. Collected deals are not touched."
        confirmLabel="Reset to defaults"
        destructive
        busy={busy}
        onConfirm={reset}
      />
    </div>
  );
}

type SectionId = "mandate" | "portfolio" | "radar" | "investors" | "contacts" | "settings";

const SECTIONS: { id: SectionId; label: string; icon: typeof Target; blurb: string }[] = [
  { id: "mandate", label: "Mandate", icon: Target, blurb: "What the family office invests in. This decides which deals count as a focus deal." },
  { id: "portfolio", label: "Portfolio", icon: Briefcase, blurb: "Companies you already back. News about them, or something close to them, is flagged." },
  { id: "radar", label: "On Radar", icon: Radar, blurb: "Companies you want to keep an eye on, with a priority." },
  { id: "investors", label: "Investors", icon: Landmark, blurb: "Investors you watch. A deal they join is called out." },
  { id: "contacts", label: "Contacts", icon: Users, blurb: "The address book used by the email drafts." },
  { id: "settings", label: "Settings", icon: SlidersHorizontal, blurb: "Profiles, digest limits, news sources and sector keywords." },
];

export function CoverageContent({ config, onChanged }: Props) {
  // Bumping the epoch rebuilds every form from fresh data after an import or reset.
  const [epoch, setEpoch] = useState(0);
  const [section, setSection] = useState<SectionId>("mandate");
  const counts: Partial<Record<SectionId, number>> = { portfolio: config.counts.portfolio, radar: config.counts.on_radar, investors: config.counts.investors, contacts: config.counts.stakeholders };
  const current = SECTIONS.find((x) => x.id === section)!;
  const refresh = () => onChanged();

  const move = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === "ArrowDown" || e.key === "ArrowRight" ? i + 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const target = SECTIONS[(next + SECTIONS.length) % SECTIONS.length];
    setSection(target.id);
    requestAnimationFrame(() => document.getElementById(`cov-tab-${target.id}`)?.focus());
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-5 pt-5 pb-3 pr-12">
        <h2 className="display text-[1.75rem] leading-none">My Coverage</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">What Funding Pulse matches the news against. Every change is saved to the database.</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col border-t md:flex-row">
        <LayoutGroup id="coverage-nav">
          <nav aria-label="My Coverage sections" className="shrink-0 border-b bg-muted/30 md:w-44 md:border-r md:border-b-0">
            <div role="tablist" aria-orientation="vertical" className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible md:p-3">
              {SECTIONS.map((x, i) => {
                const on = x.id === section;
                return (
                  <button
                    key={x.id}
                    id={`cov-tab-${x.id}`}
                    role="tab"
                    aria-selected={on}
                    aria-controls="cov-panel"
                    tabIndex={on ? 0 : -1}
                    onClick={() => setSection(x.id)}
                    onKeyDown={(e) => move(e, i)}
                    className={cn("relative flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {on ? <motion.span layoutId="cov-pill" className="absolute inset-0 rounded-lg border bg-card shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 40 }} /> : null}
                    <x.icon className="relative size-4" aria-hidden />
                    <span className="relative">{x.label}</span>
                    {counts[x.id] !== undefined ? <span className="fig relative ml-auto rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{counts[x.id]}</span> : null}
                  </button>
                );
              })}
            </div>
          </nav>
        </LayoutGroup>
        <div id="cov-panel" role="tabpanel" aria-labelledby={`cov-tab-${section}`} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <div className="mb-4 flex items-start gap-3">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
              <current.icon className="size-4.5" />
            </span>
            <div>
              <h3 className="text-base font-semibold tracking-tight">{current.label}</h3>
              <p className="text-sm text-muted-foreground">{current.blurb}</p>
            </div>
          </div>
          {section === "mandate" ? <MandateTab key={epoch} config={config} onChanged={refresh} /> : null}
          {section === "portfolio" ? <CompanyList tag="Portfolio" config={config} onChanged={refresh} /> : null}
          {section === "radar" ? <CompanyList tag="On Radar" config={config} onChanged={refresh} /> : null}
          {section === "investors" ? <InvestorsList config={config} onChanged={refresh} /> : null}
          {section === "contacts" ? <StakeholdersList config={config} onChanged={refresh} /> : null}
          {section === "settings" ? <SettingsForms key={epoch} config={config} onChanged={refresh} /> : null}
        </div>
      </div>
      <ConfigFooter
        onReplaced={() => {
          setEpoch((e) => e + 1);
          onChanged();
        }}
      />
    </div>
  );
}
