"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, ApiError } from "@/lib/client/api";
import type { ConfigResponse } from "@/lib/client/types";
import type { CompanyJson } from "@/lib/config/schema";
import { ChipsInput, Field, NativeSelect } from "@/components/common/ui-bits";

const PRIORITIES = ["high", "medium", "low"];

type Draft = {
  name: string;
  tag: "Portfolio" | "On Radar";
  sector: string;
  domain: string;
  description: string;
  aliases: string[];
  match_requires_context: string[];
  stage_last_seen: string;
  last_round_text: string;
  investors_reported: string[];
  reason_on_radar: string;
  priority: string;
  evidence_url: string;
  evidence_note: string;
};

function toDraft(c: CompanyJson | null, tag: "Portfolio" | "On Radar", sectors: string[]): Draft {
  return {
    name: c?.name ?? "",
    tag: c?.tag ?? tag,
    sector: c?.sector ?? sectors[0] ?? "Other",
    domain: c?.domain ?? "",
    description: c?.description ?? "",
    aliases: c?.aliases ?? [],
    match_requires_context: c?.match_requires_context ?? [],
    stage_last_seen: c?.stage_last_seen ?? "Unknown",
    last_round_text: c?.last_round_text ?? "",
    investors_reported: c?.investors_reported ?? [],
    reason_on_radar: c?.reason_on_radar ?? "",
    priority: c?.priority ?? "medium",
    evidence_url: c?.evidence_url ?? "",
    evidence_note: c?.evidence_note ?? "",
  };
}

export function CompanyDrawer({
  open,
  onOpenChange,
  company,
  defaultTag,
  config,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  company: CompanyJson | null;
  defaultTag: "Portfolio" | "On Radar";
  config: ConfigResponse;
  onSaved: () => void;
}) {
  const sectors = Object.keys(config.taxonomy.sectors);
  const stages = config.taxonomy.stages;
  // The parent remounts this component (via key) for every company it opens, so state starts fresh.
  const [d, setD] = useState<Draft>(() => toDraft(company, defaultTag, sectors));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const radar = d.tag === "On Radar";
  const stageOptions = Array.from(new Set([...stages, d.stage_last_seen])).map((s) => ({ value: s, label: s }));

  async function save() {
    setError(null);
    if (!d.name.trim()) {
      setError("Please enter a company name.");
      return;
    }
    const payload: Record<string, unknown> = {
      name: d.name.trim(),
      tag: d.tag,
      sector: d.sector,
      domain: d.domain.trim() ? d.domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null,
      description: d.description.trim() || null,
      aliases: d.aliases,
      match_requires_context: d.match_requires_context,
      status: company?.status ?? (d.tag === "Portfolio" ? "active" : "tracking"),
    };
    if (radar) {
      Object.assign(payload, {
        stage_last_seen: d.stage_last_seen || "Unknown",
        last_round_text: d.last_round_text.trim() || null,
        investors_reported: d.investors_reported,
        reason_on_radar: d.reason_on_radar.trim() || null,
        priority: d.priority,
        evidence_url: d.evidence_url.trim() || null,
        evidence_note: d.evidence_note.trim() || null,
        confidence: company?.confidence ?? "single-source",
        added_on: company?.added_on ?? undefined,
      });
    }
    setSaving(true);
    try {
      if (company) await api.put(`/api/companies/${company.id}`, payload);
      else await api.post("/api/companies", payload);
      toast.success(company ? `Saved changes to ${d.name}` : `Added ${d.name} to ${d.tag}`);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{company ? `Edit ${company.name}` : `Add a company`}</SheetTitle>
          <SheetDescription>
            {company ? "Changes are saved to the database and used from the next run." : "It will be matched against new deals from the next run."}
          </SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 content-start gap-4 overflow-y-auto px-4 pb-4">
          <Field label="Company name">{(id) => <Input id={id} value={d.name} onChange={(e) => set("name", e.target.value)} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="List">
              {(id) => (
                <NativeSelect
                  id={id}
                  value={d.tag}
                  onChange={(v) => set("tag", v as Draft["tag"])}
                  options={[
                    { value: "Portfolio", label: "Portfolio" },
                    { value: "On Radar", label: "On Radar" },
                  ]}
                />
              )}
            </Field>
            <Field label="Sector">
              {(id) => <NativeSelect id={id} value={d.sector} onChange={(v) => set("sector", v)} options={sectors.map((s) => ({ value: s, label: s }))} />}
            </Field>
          </div>
          <Field label="Website" hint="For example example.com. Used for the logo.">
            {(id) => <Input id={id} value={d.domain} onChange={(e) => set("domain", e.target.value)} placeholder="example.com" />}
          </Field>
          <Field label="What it does">
            {(id) => <Textarea id={id} rows={2} value={d.description} onChange={(e) => set("description", e.target.value)} />}
          </Field>
          <Field label="Other names (aliases)" hint="Used when matching news. Add spellings the press might use.">
            {(id) => <ChipsInput id={id} value={d.aliases} onChange={(v) => set("aliases", v)} />}
          </Field>
          <Field
            label="Context words (only for names shared with other companies)"
            hint="If filled, a news item only counts when one of these words appears near the name. Example: Jupiter needs neobank, banking."
          >
            {(id) => <ChipsInput id={id} value={d.match_requires_context} onChange={(v) => set("match_requires_context", v)} />}
          </Field>
          {radar ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Last seen stage">
                  {(id) => <NativeSelect id={id} value={d.stage_last_seen} onChange={(v) => set("stage_last_seen", v)} options={stageOptions} />}
                </Field>
                <Field label="Priority">
                  {(id) => <NativeSelect id={id} value={d.priority} onChange={(v) => set("priority", v)} options={PRIORITIES.map((p) => ({ value: p, label: p }))} />}
                </Field>
              </div>
              <Field label="Last round (as reported)">
                {(id) => <Input id={id} value={d.last_round_text} onChange={(e) => set("last_round_text", e.target.value)} />}
              </Field>
              <Field label="Investors reported">
                {(id) => <ChipsInput id={id} value={d.investors_reported} onChange={(v) => set("investors_reported", v)} />}
              </Field>
              <Field label="Why it is on the radar">
                {(id) => <Textarea id={id} rows={2} value={d.reason_on_radar} onChange={(e) => set("reason_on_radar", e.target.value)} />}
              </Field>
              <Field label="Source link">
                {(id) => <Input id={id} value={d.evidence_url} onChange={(e) => set("evidence_url", e.target.value)} placeholder="https://…" />}
              </Field>
              <Field label="Source note">
                {(id) => <Input id={id} value={d.evidence_note} onChange={(e) => set("evidence_note", e.target.value)} />}
              </Field>
            </>
          ) : null}
        </div>
        <SheetFooter className="border-t">
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : company ? "Save changes" : "Add company"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
