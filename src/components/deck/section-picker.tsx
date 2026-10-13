"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DECK_SECTIONS, DEFAULT_DECK_SECTIONS, type DeckSectionId } from "@/lib/deck/sections";

const SAVED = "fp:deck-sections";

/** The last choice, kept in this browser only. Falls back to the default ticks when nothing is saved. */
export function loadSavedSections(): DeckSectionId[] {
  try {
    const raw = window.localStorage.getItem(SAVED);
    if (!raw) return DEFAULT_DECK_SECTIONS;
    const ids = (JSON.parse(raw) as string[]).filter((x) => DECK_SECTIONS.some((s) => s.id === x)) as DeckSectionId[];
    return ids.length ? ids : DEFAULT_DECK_SECTIONS;
  } catch {
    return DEFAULT_DECK_SECTIONS;
  }
}
export function saveSections(ids: DeckSectionId[]) {
  try {
    window.localStorage.setItem(SAVED, JSON.stringify(ids));
  } catch {
    /* private window: the choice simply is not remembered */
  }
}

/** The tick list shared by the PDF dialog and the LP note. */
export function SectionPicker({ value, onChange, showEmailHint, compact }: { value: DeckSectionId[]; onChange: (v: DeckSectionId[]) => void; showEmailHint?: boolean; compact?: boolean }) {
  const set = new Set(value);
  const toggle = (id: DeckSectionId, on: boolean) => onChange(DECK_SECTIONS.map((s) => s.id).filter((x) => (x === id ? on : set.has(x))));
  return (
    <fieldset className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <legend className="text-sm font-medium">Sections to include</legend>
        <span className="flex gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={() => onChange(DECK_SECTIONS.map((s) => s.id))}>
            All
          </Button>
          <Button type="button" variant="ghost" size="xs" onClick={() => onChange([])}>
            None
          </Button>
        </span>
      </div>
      <ul className={compact ? "grid gap-1.5 sm:grid-cols-2" : "grid gap-1"}>
        {DECK_SECTIONS.map((s) => (
          <li key={s.id}>
            <label title={compact ? s.hint : undefined} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 text-sm transition-colors hover:border-ring/40 has-[[aria-checked=true]]:border-primary/40 has-[[aria-checked=true]]:bg-accent/40 ${compact ? "items-center py-1.5" : "py-2"}`}>
              <Checkbox className={compact ? "" : "mt-0.5"} checked={set.has(s.id)} onCheckedChange={(v) => toggle(s.id, v === true)} />
              <span className="min-w-0">
                <span className="block font-medium">
                  {s.label}
                  {showEmailHint && !s.email ? <span className="ml-2 text-xs font-normal text-muted-foreground">deck only</span> : null}
                </span>
                {compact ? null : <span className="block text-xs text-muted-foreground">{s.hint}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
