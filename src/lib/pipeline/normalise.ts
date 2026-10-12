/** Normalisation: sectors, stages and amounts. Pure code, no AI and no network. */
import { wordRegex } from "@/lib/matching";
import { convertAmount, parseAmountText, toBaseAmount, type AmountUnit, type Currency } from "@/lib/money";

/** Picks the sector whose keywords appear most often as whole words. Returns null when none appear. */
export function mapSectorByKeywords(text: string, sectors: Record<string, string[]>): string | null {
  let best: { sector: string; hits: number } | null = null;
  for (const [sector, words] of Object.entries(sectors)) {
    if (sector === "Other") continue;
    let hits = 0;
    for (const w of words) {
      const re = wordRegex(w, "gi");
      const m = text.match(re);
      if (m) hits += m.length;
    }
    if (hits > 0 && (!best || hits > best.hits)) best = { sector, hits };
  }
  return best?.sector ?? null;
}

/**
 * Uses Gemini's sector when it is one of the configured sectors. Otherwise falls back to keywords,
 * then to "Other".
 */
export function resolveSector(geminiSector: string | null | undefined, fallbackText: string, sectors: Record<string, string[]>): string {
  if (geminiSector) {
    const hit = Object.keys(sectors).find((s) => s.toLowerCase() === geminiSector.trim().toLowerCase());
    if (hit) return hit;
  }
  return mapSectorByKeywords(fallbackText, sectors) ?? "Other";
}

export function normaliseStage(raw: string | null | undefined, stages: string[]): string {
  const unknown = stages.includes("Unknown") ? "Unknown" : (stages[stages.length - 1] ?? "Unknown");
  if (!raw) return unknown;
  const t = raw.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  let out: string | null = null;
  if (/\b(venture )?debt\b|term loan|\bncd\b|debt financing|credit facility/.test(t)) out = "Debt";
  else if (/pre ?series ?a/.test(t)) out = "Pre-Series A";
  else if (/pre ?seed/.test(t)) out = "Pre-seed";
  else if (/series ?a\b|series ?a\d|series ?a\+/.test(t)) out = "Series A";
  else if (/series ?[b-z]\b|series ?[b-z]\d|series ?[b-z]\+/.test(t)) out = "Series B+";
  else if (/\bseed\b/.test(t)) out = "Seed";
  if (out && stages.includes(out)) return out;
  // An exact configured name still works (for custom stage lists).
  const exact = stages.find((s) => s.toLowerCase() === t);
  return exact ?? unknown;
}

export interface AmountInput {
  amountText: string | null;
  value: number | null;
  unit: AmountUnit | null;
  currency: Currency | null;
}

/** Code does all the arithmetic. The text is parsed first; Gemini's structured fields are the fallback. */
export function resolveAmount(input: AmountInput, rate: number): { usd: number | null; inr: number | null } {
  const parsed = parseAmountText(input.amountText);
  if (parsed) {
    const { usd, inr } = convertAmount(parsed.base, parsed.currency, rate);
    return { usd, inr };
  }
  if (input.value !== null && input.value > 0 && input.currency) {
    const base = toBaseAmount(input.value, input.unit);
    const { usd, inr } = convertAmount(base, input.currency, rate);
    return { usd, inr };
  }
  return { usd: null, inr: null };
}
