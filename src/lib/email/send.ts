import "server-only";
import { and, count, eq, gte, desc } from "drizzle-orm";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { db } from "@/db";
import { sentEmails } from "@/db/schema";
import { getBlocks, listStakeholders } from "@/lib/config/store";
import { HOUR, hit } from "@/lib/rate-limit";
import { checkRecipient, friendlyResendError } from "./rules";
import { MessageEmail } from "./templates";
import React from "react";

export type SendType = "digest" | "founder_outreach" | "portfolio_followup" | "lp_brief" | "other";

export interface SendRequest {
  to: string;
  subject: string;
  type: SendType;
  /** Plain text body. Used as the text version and, unless html is given, to build the HTML. */
  text: string;
  html?: string;
  /** Anonymised caller id, for the per-visitor hourly limit on addresses that are not in the address book. */
  callerId?: string;
}

export interface SendResult {
  ok: boolean;
  message: string;
  status: "sent" | "blocked" | "failed";
}

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY?.trim() && !!process.env.RESEND_FROM?.trim();
}

async function log(to: string, type: string, subject: string, status: string, error?: string) {
  await db.insert(sentEmails).values({ recipient: to, type, subject, status, error: error ?? null });
}

/** Every outgoing email goes through here: validation, demo-address block, daily cap, per-visitor cap, Resend, log. */
export async function sendEmail(req: SendRequest): Promise<SendResult> {
  const blocks = await getBlocks();
  const settings = blocks.digest_settings;
  const stakeholders = await listStakeholders();
  const check = checkRecipient(req.to, { stakeholders, digestRecipients: settings.recipients });
  if (!check.ok) {
    await log(req.to.slice(0, 200), req.type, req.subject, "blocked", check.message);
    return { ok: false, message: check.message, status: "blocked" };
  }
  const startOfDay = new Date(`${new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)}T00:00:00+05:30`);
  const [{ n }] = await db.select({ n: count() }).from(sentEmails).where(and(eq(sentEmails.status, "sent"), gte(sentEmails.sentAt, startOfDay)));
  if (n >= settings.daily_send_cap) {
    const message = `The daily limit of ${settings.daily_send_cap} emails has been reached. Please try again tomorrow.`;
    await log(check.email, req.type, req.subject, "blocked", message);
    return { ok: false, message, status: "blocked" };
  }
  if (!check.known && req.callerId) {
    const r = await hit(`send:${req.callerId}`, HOUR, settings.send_per_ip_per_hour);
    if (!r.allowed) {
      const message = `You have sent to ${settings.send_per_ip_per_hour} new addresses in the last hour. Add this person to the address book, or try again later.`;
      await log(check.email, req.type, req.subject, "blocked", message);
      return { ok: false, message, status: "blocked" };
    }
  }
  if (!emailConfigured()) {
    const message = "Email sending is not set up yet (the Resend key or sender address is missing).";
    await log(check.email, req.type, req.subject, "failed", message);
    return { ok: false, message, status: "failed" };
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const html = req.html ?? (await render(React.createElement(MessageEmail, { body: req.text })));
    const { error } = await resend.emails.send({ from: process.env.RESEND_FROM!, to: [check.email], subject: req.subject, html, text: req.text });
    if (error) {
      const message = friendlyResendError((error as { message?: string }).message, (error as { statusCode?: number }).statusCode);
      await log(check.email, req.type, req.subject, "failed", message);
      return { ok: false, message, status: "failed" };
    }
    await log(check.email, req.type, req.subject, "sent");
    return { ok: true, message: `Sent to ${check.email}.`, status: "sent" };
  } catch (e) {
    const message = friendlyResendError(e instanceof Error ? e.message : undefined);
    await log(check.email, req.type, req.subject, "failed", message);
    return { ok: false, message, status: "failed" };
  }
}

export async function recentSends(limit = 15) {
  return db.select().from(sentEmails).orderBy(desc(sentEmails.id)).limit(limit);
}
