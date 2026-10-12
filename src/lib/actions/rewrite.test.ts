import { describe, expect, it } from "vitest";
import { bulletCount, joinDraft, notEnoughChange, similarity, splitDraft } from "./rewrite";

const body = "Hi Aman,\n\nCongratulations on the round.\n\nWould you be open to a call?\n\nWarm regards,\nAarav\nVenture Scout, Cloudburst Ventures";

describe("rewrite helpers", () => {
  it("splits and rejoins a draft without changing it", () => {
    const p = splitDraft(body);
    expect(p.greeting).toBe("Hi Aman,");
    expect(p.middle).toBe("Congratulations on the round.\n\nWould you be open to a call?");
    expect(p.signoff).toBe("Warm regards,\nAarav\nVenture Scout, Cloudburst Ventures");
    expect(joinDraft(p)).toBe(body);
  });
  it("copes with a draft that has no greeting or sign-off", () => {
    expect(splitDraft("Just a line.")).toEqual({ greeting: "", middle: "Just a line.", signoff: "" });
  });
  it("measures how close two texts are", () => {
    expect(similarity("a b c d", "a b c d")).toBe(1);
    expect(similarity("a b c d", "w x y z")).toBe(0);
  });
  it("asks for another try when warmer is the same text, or shorter is not shorter", () => {
    expect(notEnoughChange("warmer", "Congratulations on the round today", "Congratulations on the round today!")).toMatch(/almost the same/);
    expect(notEnoughChange("warmer", "Congratulations on the round", "What wonderful news about your round, we are thrilled")).toBeNull();
    expect(notEnoughChange("shorter", "x".repeat(100), "x".repeat(95))).toMatch(/shorter/);
    expect(notEnoughChange("shorter", "x".repeat(100), "x".repeat(60))).toBeNull();
  });
  it("counts bullets", () => {
    expect(bulletCount("• one\n• two\ntext")).toBe(2);
  });
});
