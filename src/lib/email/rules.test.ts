import { describe, expect, it } from "vitest";
import { checkRecipient, friendlyResendError } from "./rules";

const rules = {
  stakeholders: [
    { email: "demo.lp@example.com", demo: true },
    { email: "real.lp@family.in", demo: false },
  ],
  digestRecipients: ["aarav@family.in"],
};

describe("checkRecipient", () => {
  it("refuses invalid addresses", () => {
    const r = checkRecipient("not-an-email", rules);
    expect(r.ok).toBe(false);
  });
  it("refuses example.com and demo stakeholders with a clear message", () => {
    const a = checkRecipient("demo.lp@example.com", rules);
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.message).toContain("demo contact");
    expect(checkRecipient("anyone@example.com", rules).ok).toBe(false);
    expect(checkRecipient("x@example.org", rules).ok).toBe(false);
  });
  it("allows address-book and digest-recipient addresses freely", () => {
    expect(checkRecipient("Real.LP@family.in", rules)).toMatchObject({ ok: true, known: true });
    expect(checkRecipient("aarav@family.in", rules)).toMatchObject({ ok: true, known: true });
  });
  it("allows other addresses but marks them as not known (they count toward the hourly limit)", () => {
    expect(checkRecipient("someone@else.com", rules)).toMatchObject({ ok: true, known: false });
  });
});

describe("friendlyResendError", () => {
  it("explains the testing-address restriction", () => {
    expect(friendlyResendError("You can only send testing emails to your own email address (a@b.com)", 403)).toContain("owns the Resend account");
  });
  it("explains an unverified domain", () => {
    expect(friendlyResendError("The domain is not verified")).toContain("not verified");
  });
  it("falls back to Resend's own words", () => {
    expect(friendlyResendError("Something odd")).toContain("Something odd");
  });
});
