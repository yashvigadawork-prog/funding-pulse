"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/client/api";
import type { ConfigResponse } from "@/lib/client/types";
import type { Mandate } from "@/lib/config/schema";
import { Field, SaveBar } from "@/components/common/ui-bits";

export function MandateTab({ config, onChanged }: { config: ConfigResponse; onChanged: () => void }) {
  const [m, setM] = useState<Mandate>(() => structuredClone(config.mandate));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sectors = Object.keys(config.taxonomy.sectors).filter((s) => s !== "Other");

  const toggleSector = (s: string, on: boolean) =>
    setM((p) => ({ ...p, focus_sectors: on ? [...p.focus_sectors, s] : p.focus_sectors.filter((x) => x !== s) }));
  const patchStage = (name: string, patch: Partial<Mandate["stages"][number]>) =>
    setM((p) => ({ ...p, stages: p.stages.map((s) => (s.name === name ? { ...s, ...patch } : s)) }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.put("/api/config/mandate", m);
      setSavedAt(new Date());
      toast.success("Mandate saved");
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Focus sectors</legend>
        {sectors.map((s) => (
          <label key={s} className="flex items-center gap-2 text-sm">
            <Checkbox checked={m.focus_sectors.includes(s)} onCheckedChange={(v) => toggleSector(s, v === true)} />
            {s}
          </label>
        ))}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Stages</legend>
        <p className="text-xs text-muted-foreground">
          &ldquo;In focus&rdquo; stages are the ones the fund writes first cheques in. &ldquo;Follow-on only&rdquo; stages count only for companies already in Portfolio or On Radar.
        </p>
        <ul className="grid gap-1.5">
          {m.stages.map((s) => (
            <li key={s.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border px-2.5 py-2 text-sm">
              <span className="font-medium">{s.name}</span>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch size="sm" checked={s.focus} onCheckedChange={(v) => patchStage(s.name, { focus: v })} aria-label={`${s.name} in focus`} />
                In focus
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch size="sm" checked={s.follow_on_only} onCheckedChange={(v) => patchStage(s.name, { follow_on_only: v })} aria-label={`${s.name} follow-on only`} />
                Follow-on only
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">Ticket size (USD)</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                placeholder="Not set"
                value={m.ticket_size_usd.min ?? ""}
                onChange={(e) => setM((p) => ({ ...p, ticket_size_usd: { ...p.ticket_size_usd, min: num(e.target.value) } }))}
              />
            )}
          </Field>
          <Field label="Maximum">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                placeholder="Not set"
                value={m.ticket_size_usd.max ?? ""}
                onChange={(e) => setM((p) => ({ ...p, ticket_size_usd: { ...p.ticket_size_usd, max: num(e.target.value) } }))}
              />
            )}
          </Field>
        </div>
        <Field label="Note">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={m.ticket_size_usd.note ?? ""}
              onChange={(e) => setM((p) => ({ ...p, ticket_size_usd: { ...p.ticket_size_usd, note: e.target.value } }))}
            />
          )}
        </Field>
      </fieldset>

      <label className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
        <span>
          <span className="block font-medium">Show other sectors to note</span>
          <span className="block text-xs text-muted-foreground">Flags speeding-up or slowing sectors outside the focus list.</span>
        </span>
        <Switch checked={m.other_sectors_to_note} onCheckedChange={(v) => setM((p) => ({ ...p, other_sectors_to_note: v }))} aria-label="Show other sectors to note" />
      </label>

      <SaveBar onSave={save} saving={saving} savedAt={savedAt} error={error} />
    </div>
  );
}
