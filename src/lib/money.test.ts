import { describe, expect, it } from "vitest";
import { amountLabel, amountSpoken, formatInr, formatUsd } from "./money";

describe("one clean amount", () => {
  it("shows rupees first and dollars second, never a pile of raw strings", () => {
    expect(amountLabel({ amountUsd: 9_000_000, amountInr: 861_300_000 })).toBe("₹86.13 Cr · $9M");
  });
  it("shows Undisclosed when there is no amount, and a range when outlets disagree", () => {
    expect(amountLabel({ amountUsd: null, amountInr: null })).toBe("Undisclosed");
    expect(amountLabel({ amountUsd: 2_500_000, amountInr: 1, amountMinUsd: 2_000_000, amountMaxUsd: 3_000_000 })).toBe("$2M to $3M");
  });
  it("formats lakh, crore and dollars", () => {
    expect(formatInr(7_500_000)).toBe("₹75 L");
    expect(formatInr(1_435_500_000)).toBe("₹143.55 Cr");
    expect(formatUsd(150_000_000)).toBe("$150M");
  });
});

describe("amounts the way a person says them", () => {
  it("says dollars in words with the rupee amount after", () => {
    expect(amountSpoken({ amountUsd: 3_700_000, amountInr: 354_090_000 })).toBe("$3.7 million (about ₹35.4 crore)");
    expect(amountSpoken({ amountUsd: 1_200_000_000, amountInr: 114_840_000_000 })).toBe("$1.2 billion (about ₹11,484 crore)");
    expect(amountSpoken({ amountUsd: 620_000, amountInr: 59_334_000 })).toBe("$620 thousand (about ₹5.9 crore)");
  });
  it("returns null when undisclosed so nothing is guessed", () => {
    expect(amountSpoken({ amountUsd: null, amountInr: null })).toBeNull();
  });
});
