import "server-only";
import { stageLabel } from "@/lib/format";
import { and, eq, isNull } from "drizzle-orm";
import { render } from "@react-email/render";
import React from "react";
import { db } from "@/db";
import { digests } from "@/db/schema";
import { getBlocks } from "@/lib/config/store";
import { formatInr, formatUsd } from "@/lib/money";
import type { StepLog } from "@/lib/pipeline/runs";
import type { Analysis } from "@/lib/pipeline/analyse";
import type { StoredHighlight } from "@/lib/pipeline/digest";
import { formatWeekRange } from "@/lib/time";
import { appUrl } from "@/lib/url";
import { scrubDeep } from "@/lib/forbidden";
import { sendEmail } from "./send";
import { DigestEmail, type DigestEmailProps } from "./templates";

type Kpis = { deals: number; disclosedUsd: number; disclosedInr: number; topSector: string | null; directHits?: number; watchlistHits: number; adjacentHits?: number; newInvestors: number };

export function kpiLine(k: Kpis): string {
  const parts = [`${k.deals} deal${k.deals === 1 ? "" : "s"}`, k.disclosedUsd > 0 ? `${formatInr(k.disclosedInr)} (${formatUsd(k.disclosedUsd)}) disclosed` : "no amounts disclosed"];
  if (k.topSector) parts.push(`${k.topSector} leads`);
  parts.push(`${k.directHits ?? k.watchlistHits} watchlist hit${(k.directHits ?? k.watchlistHits) === 1 ? "" : "s"}${k.adjacentHits ? `, ${k.adjacentHits} adjacent` : ""}`);
  parts.push(`${k.newInvestors} new investor${k.newInvestors === 1 ? "" : "s"} in our records`);
  return parts.join(" · ");
}

export async function buildDigestEmail(week: string): Promise<{ props: DigestEmailProps; html: string; text: string; subject: string } | null> {
  const [row] = await db.select().from(digests).where(eq(digests.weekStart, week)).limit(1);
  if (!row) return null;
  const blocks = await getBlocks();
  const k = row.kpis as Kpis;
  const hl = (row.highlights as StoredHighlight[]).slice(0, blocks.digest_settings.highlights_top);
  const analysis = row.analysis as Analysis;
  const props: DigestEmailProps = {
    orgName: blocks.fund_profile.name,
    orgDescriptor: `${blocks.fund_profile.type}, ${blocks.fund_profile.location}`,
    weekLabel: formatWeekRange(week),
    kpiLine: kpiLine(k),
    highlights: hl.map((h) => ({
      rank: h.rank,
      company: h.companyName,
      detail: `${h.sector} · ${stageLabel(h.stage)} · ${h.amountUsd !== null ? `${formatInr(h.amountInr)} (${formatUsd(h.amountUsd)})` : "Undisclosed"}${h.matchTag ? ` · ${h.matchTag}` : ""}`,
      why: h.why,
      url: h.sources[0]?.url ?? null,
      outlet: h.sources[0]?.outlet ?? null,
    })),
    dashboardUrl: `${appUrl()}/?week=${week}`,
    note: analysis.source === "template" && analysis.reason === "ai_unavailable" ? "Written from a template because the AI service was unavailable. The numbers are unaffected." : undefined,
  };
  const el = React.createElement(DigestEmail, scrubDeep(props));
  return { props, html: await render(el), text: await render(el, { plainText: true }), subject: `Funding Pulse: ${formatWeekRange(week)}` };
}

/** Sends the digest to the configured recipients, once. The claim on emailed_at makes repeat calls do nothing. */
export async function sendDigestEmail(week: string, log: StepLog): Promise<void> {
  await log.step("send", async () => {
    const blocks = await getBlocks();
    const recipients = blocks.digest_settings.recipients;
    if (!recipients.length) return { message: "No digest recipients are set (Settings, Digest settings), so no email was sent.", status: "skipped" as const };
    const claimed = await db.update(digests).set({ emailedAt: new Date() }).where(and(eq(digests.weekStart, week), isNull(digests.emailedAt))).returning({ id: digests.id });
    if (!claimed.length) return { message: "This week's digest was already emailed, so nothing was sent again.", status: "skipped" as const };
    const mail = await buildDigestEmail(week);
    if (!mail) return { message: "No digest found to send.", status: "skipped" as const };
    let sent = 0;
    const problems: string[] = [];
    for (const to of recipients) {
      const r = await sendEmail({ to, subject: mail.subject, type: "digest", text: mail.text, html: mail.html });
      if (r.ok) sent++;
      else problems.push(`${to}: ${r.message}`);
    }
    if (sent === 0) await db.update(digests).set({ emailedAt: null }).where(eq(digests.weekStart, week));
    return {
      message: `Digest emailed to ${sent} of ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.${problems.length ? ` Problems: ${problems.join(" | ").slice(0, 400)}` : ""}`,
      counts: { sent, failed: problems.length },
      status: sent === 0 ? ("partial" as const) : ("ok" as const),
    };
  });
}
