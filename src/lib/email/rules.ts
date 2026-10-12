/** Who may be emailed. Pure functions so the rules are easy to test. */
import { z } from "zod";

export interface RecipientRules {
  stakeholders: { email: string; demo: boolean }[];
  digestRecipients: string[];
}

export type RecipientCheck = { ok: true; known: boolean; email: string } | { ok: false; message: string };

const RESERVED = /@(example\.(com|net|org)|.*\.example|.*\.invalid|.*\.test|localhost)$/i;

export function checkRecipient(raw: string, rules: RecipientRules): RecipientCheck {
  const email = raw.trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { ok: false, message: "That does not look like a valid email address." };
  const stakeholder = rules.stakeholders.find((s) => s.email.toLowerCase() === email);
  if (RESERVED.test(email) || stakeholder?.demo)
    return { ok: false, message: "This is a demo contact (example.com), so no real email is sent to it. Pick a real address to send." };
  const known = !!stakeholder || rules.digestRecipients.some((r) => r.toLowerCase() === email);
  return { ok: true, known, email };
}

/** Turns Resend's refusal into words a non-technical person can act on. */
export function friendlyResendError(message: string | undefined, status?: number): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("only send testing emails to your own") || m.includes("own email address"))
    return "Resend only allows sending to the address that owns the Resend account until a sending domain is verified. Try your own address, or verify a domain in Resend.";
  if (m.includes("domain") && (m.includes("not verified") || m.includes("verify")))
    return "The sending domain is not verified in Resend yet, so this email was refused.";
  if (status === 401 || m.includes("api key") || m.includes("unauthorized"))
    return "The email service key is missing or not valid. Check RESEND_API_KEY in the settings.";
  if (status === 429 || m.includes("rate limit")) return "Resend is limiting how fast emails can go out. Please wait a minute and try again.";
  if (m.includes("invalid") && m.includes("from")) return "The sender address (RESEND_FROM) is not valid for this Resend account.";
  return message ? `Resend refused this email: ${message}` : "The email service did not accept this email. Please try again.";
}
