import { z } from "zod";
import { handle, HttpError, readJson } from "@/lib/api";
import { sendEmail } from "@/lib/email/send";
import { clientId } from "@/lib/rate-limit";
import { scrubText } from "@/lib/forbidden";
import { buildDeckPdf } from "@/lib/deck";
import { limitDeckPdf } from "@/lib/deck/limits";
import { DECK_SECTIONS, type DeckSectionId } from "@/lib/deck/sections";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({
  to: z.string().min(3).max(200),
  subject: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(20_000),
  type: z.enum(["founder_outreach", "portfolio_followup", "lp_brief", "other"]),
  confirm: z.literal(true, { error: "Please confirm before sending." }),
  /** Attach the summary deck for this week, built from the ticked sections. */
  attachDeck: z
    .object({
      week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sections: z.array(z.enum(DECK_SECTIONS.map((s) => s.id) as [string, ...string[]])).min(1, "Please tick at least one section for the deck."),
    })
    .optional(),
});

export const POST = handle(async (req: Request) => {
  const b = body.parse(await readJson(req));
  const deck = b.attachDeck;
  if (deck) await limitDeckPdf(req);
  const r = await sendEmail({
    to: b.to,
    subject: scrubText(b.subject),
    text: scrubText(b.text),
    type: b.type,
    callerId: clientId(req),
    attachments: deck
      ? async () => {
          const { pdf, filename } = await buildDeckPdf(deck.week, deck.sections as DeckSectionId[]);
          return [{ filename, content: pdf }];
        }
      : undefined,
  });
  if (!r.ok) throw new HttpError(422, r.message, { status: r.status });
  return Response.json(r);
});
