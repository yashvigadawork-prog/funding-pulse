/** Money helpers. Rates always come from config; nothing here hard-codes an exchange rate. */

export type AmountUnit = "thousand" | "lakh" | "million" | "crore" | "billion";
export type Currency = "USD" | "INR";

const UNIT_MULT: Record<AmountUnit, number> = {
  thousand: 1e3,
  lakh: 1e5,
  million: 1e6,
  crore: 1e7,
  billion: 1e9,
};

export function toBaseAmount(value: number, unit: AmountUnit | null | undefined): number {
  return value * (unit ? UNIT_MULT[unit] : 1);
}

export function convertAmount(
  value: number,
  currency: Currency,
  rate: number,
): { usd: number; inr: number } {
  return currency === "USD" ? { usd: value, inr: value * rate } : { usd: value / rate, inr: value };
}

/**
 * Reads amounts such as "$5 million", "Rs 40 crore", "₹2.5 Cr", "INR 12 Cr", "US$ 3M".
 * Returns null for "Undisclosed" or anything it cannot read, so nothing is ever guessed.
 */
export function parseAmountText(
  text: string | null | undefined,
): { value: number; currency: Currency; unit: AmountUnit | null; base: number } | null {
  if (!text) return null;
  const t = text.replace(/,/g, "").trim();
  if (/undisclosed|not disclosed|not reported|n\/a/i.test(t)) return null;
  const re =
    /(US\s?\$|\$|USD|INR|Rs\.?|₹)\s*(\d+(?:\.\d+)?)\s*(thousand|lakh|lakhs|lac|million|mn|m|crore|crores|cr|billion|bn|b|k)?\b|(\d+(?:\.\d+)?)\s*(thousand|lakh|lakhs|lac|million|mn|crore|crores|cr|billion|bn|k)?\s*(USD|INR|dollars?|rupees?)\b/i;
  const m = t.match(re);
  if (!m) return null;
  let curToken: string;
  let numToken: string;
  let unitToken: string | undefined;
  if (m[1]) {
    curToken = m[1];
    numToken = m[2];
    unitToken = m[3];
  } else {
    curToken = m[6];
    numToken = m[4];
    unitToken = m[5];
  }
  const currency: Currency = /^(US\s?\$|\$|USD|dollar)/i.test(curToken) ? "USD" : "INR";
  const value = parseFloat(numToken);
  if (!Number.isFinite(value)) return null;
  let unit: AmountUnit | null = null;
  const u = unitToken?.toLowerCase();
  if (u) {
    if (u === "k" || u === "thousand") unit = "thousand";
    else if (u.startsWith("lak") || u === "lac") unit = "lakh";
    else if (u === "m" || u === "mn" || u === "million") unit = "million";
    else if (u.startsWith("cr")) unit = "crore";
    else if (u === "b" || u === "bn" || u === "billion") unit = "billion";
  }
  return { value, currency, unit, base: toBaseAmount(value, unit) };
}

const nf = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** Indian style: lakh and crore. */
export function formatInr(inr: number | null | undefined): string {
  if (inr === null || inr === undefined) return "Undisclosed";
  const abs = Math.abs(inr);
  if (abs >= 1e7) return `₹${nf.format(inr / 1e7)} Cr`;
  if (abs >= 1e5) return `₹${nf.format(inr / 1e5)} L`;
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(inr)}`;
}

export function formatUsd(usd: number | null | undefined): string {
  if (usd === null || usd === undefined) return "Undisclosed";
  const abs = Math.abs(usd);
  const f = (n: number) => (Math.round(n * 10) / 10).toString();
  if (abs >= 1e9) return `$${f(usd / 1e9)}B`;
  if (abs >= 1e6) return `$${f(usd / 1e6)}M`;
  if (abs >= 1e3) return `$${f(usd / 1e3)}K`;
  return `$${Math.round(usd)}`;
}

export function formatMoneyPair(usd: number | null | undefined, inr: number | null | undefined): string {
  if (usd === null || usd === undefined) return "Undisclosed";
  return `${formatInr(inr)} (${formatUsd(usd)})`;
}
