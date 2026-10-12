"use client";

import { useRef, useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/client/api";
import type { ConfigResponse } from "@/lib/client/types";
import { ConfirmDialog } from "@/components/common/ui-bits";
import { CompanyList } from "./company-list";
import { MandateTab } from "./mandate-tab";
import { InvestorsList, StakeholdersList } from "./people-lists";
import { SettingsForms } from "./settings-forms";

type Props = { config: ConfigResponse; onChanged: () => void };

function MoreTab({ config, onChanged }: Props) {
  const [section, setSection] = useState<"investors" | "stakeholders" | "settings">("investors");
  const opts = [
    { v: "investors", l: `Investors (${config.counts.investors})` },
    { v: "stakeholders", l: `Contacts (${config.counts.stakeholders})` },
    { v: "settings", l: "Settings" },
  ] as const;
  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label="More" className="flex flex-wrap gap-1">
        {opts.map((o) => (
          <button
            key={o.v}
            role="tab"
            aria-selected={section === o.v}
            onClick={() => setSection(o.v)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              section === o.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
      {section === "investors" ? <InvestorsList config={config} onChanged={onChanged} /> : null}
      {section === "stakeholders" ? <StakeholdersList config={config} onChanged={onChanged} /> : null}
      {section === "settings" ? <SettingsForms config={config} onChanged={onChanged} /> : null}
    </div>
  );
}

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
    <div className="grid gap-2 border-t px-4 py-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" nativeButton={false} render={<a href="/api/config/export" download />}>
          <Download data-icon="inline-start" /> Export config
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload data-icon="inline-start" /> Import config
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
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

export function CoverageContent({ config, onChanged }: Props) {
  // Bumping the epoch rebuilds every form from fresh data after an import or reset.
  const [epoch, setEpoch] = useState(0);
  const refresh = () => onChanged();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-base font-semibold tracking-tight">My Coverage</h2>
        <p className="text-xs text-muted-foreground">What we match news against. Edits save to the database.</p>
      </div>
      <Tabs defaultValue="mandate" className="min-h-0 flex-1 gap-0">
        <TabsList className="mx-4 h-auto flex-wrap justify-start">
          <TabsTrigger value="mandate">Mandate</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio ({config.counts.portfolio})</TabsTrigger>
          <TabsTrigger value="radar">On Radar ({config.counts.on_radar})</TabsTrigger>
          <TabsTrigger value="more">More</TabsTrigger>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <TabsContent value="mandate">
            <MandateTab key={epoch} config={config} onChanged={refresh} />
          </TabsContent>
          <TabsContent value="portfolio">
            <CompanyList tag="Portfolio" config={config} onChanged={refresh} />
          </TabsContent>
          <TabsContent value="radar">
            <CompanyList tag="On Radar" config={config} onChanged={refresh} />
          </TabsContent>
          <TabsContent value="more">
            <MoreTab key={epoch} config={config} onChanged={refresh} />
          </TabsContent>
        </div>
      </Tabs>
      <ConfigFooter
        onReplaced={() => {
          setEpoch((e) => e + 1);
          onChanged();
        }}
      />
    </div>
  );
}
