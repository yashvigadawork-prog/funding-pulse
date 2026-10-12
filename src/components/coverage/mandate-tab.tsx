"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/client/api";
import type { ConfigResponse } from "@/lib/client/types";
import type { Mandate } from "@/lib/config/schema";
import { Field, SectorDot } from "@/components/common/ui-bits";
import { cn } from "@/lib/utils";

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

  const dirty = JSON.stringify(m) !== JSON.stringify(config.mandate);
  const stageMode = (s: Mandate["stages"][number]) => (s.follow_on_only && !s.focus ? "follow" : s.focus ? "focus" : "off");
  const STAGE_CHOICES = [
    { v: "off", l: "Not used", patch: { focus: false, follow_on_only: false } },
    { v: "focus", l: "In focus", patch: { focus: true, follow_on_only: false } },
    { v: "follow", l: "Follow-on only", patch: { focus: false, follow_on_only: true } },
  ] as const;

  return (
    <div className="grid gap-4">
      <Card title="Focus sectors" hint="Deals in these sectors can be focus deals.">
        <div role="group" aria-label="Focus sectors" className="grid gap-2 sm:grid-cols-2">
          {sectors.map((s) => {
            const on = m.focus_sectors.includes(s);
            return (
              <button
                key={s}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggleSector(s, !on)}
                className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary/50 bg-accent text-accent-foreground" : "bg-background text-muted-foreground hover:border-ring/40 hover:text-foreground")}
              >
                <SectorDot sector={s} className="size-2.5" />
                <span className="flex-1">{s}</span>
                <span aria-hidden className={cn("grid size-5 place-items-center rounded-full border transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                  {on ? <Check className="size-3" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Stages" hint="In focus: stages where the family office writes first cheques. Follow-on only: counts only for companies already in Portfolio or On Radar.">
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {m.stages.map((s) => (
            <li key={s.name} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2">
              <span className="text-sm font-medium">{s.name}</span>
              <div role="radiogroup" aria-label={`${s.name} stage use`} className="inline-flex rounded-lg bg-muted p-0.5">
                {STAGE_CHOICES.map((c) => {
                  const on = stageMode(s) === c.v;
                  return (
                    <button
                      key={c.v}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => patchStage(s.name, c.patch)}
                      className={cn("rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      {c.l}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Ticket size" hint="In US dollars. Leave blank for no limit.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum">
            {(id) => (
              <MoneyInput id={id} value={m.ticket_size_usd.min} onChange={(v) => setM((p) => ({ ...p, ticket_size_usd: { ...p.ticket_size_usd, min: v } }))} />
            )}
          </Field>
          <Field label="Maximum">
            {(id) => (
              <MoneyInput id={id} value={m.ticket_size_usd.max} onChange={(v) => setM((p) => ({ ...p, ticket_size_usd: { ...p.ticket_size_usd, max: v } }))} />
            )}
          </Field>
        </div>
        <Field label="Note">
          {(id) => <Textarea id={id} rows={2} value={m.ticket_size_usd.note ?? ""} onChange={(e) => setM((p) => ({ ...p, ticket_size_usd: { ...p.ticket_size_usd, note: e.target.value } }))} />}
        </Field>
      </Card>

      <label className="flex items-start justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
        <span>
          <span className="block font-medium">Show other sectors to note</span>
          <span className="block text-xs text-muted-foreground">Flags speeding-up or slowing sectors outside the focus list.</span>
        </span>
        <Switch checked={m.other_sectors_to_note} onCheckedChange={(v) => setM((p) => ({ ...p, other_sectors_to_note: v }))} aria-label="Show other sectors to note" />
      </label>

      <div className="sticky -bottom-4 z-10 -mx-5 flex items-center justify-between gap-3 border-t bg-background/90 px-5 py-3 backdrop-blur">
        <span className={cn("text-xs font-medium", dirty ? "text-warning-ink" : "text-muted-foreground")}>{dirty ? "You have unsaved changes" : savedAt ? `Saved at ${savedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}. It applies from the next run.` : "Everything is saved"}</span>
        <div className="flex items-center gap-2" aria-live="polite">
          {error ? <span className="text-xs font-medium text-destructive">{error}</span> : null}
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-2xl border bg-card px-4 py-3.5">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MoneyInput({ id, value, onChange }: { id: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <Input id={id} type="number" min={0} placeholder="Not set" className="fig pl-6" value={value ?? ""} onChange={(e) => onChange(e.target.value.trim() === "" ? null : Number(e.target.value))} />
    </div>
  );
}
