import { z } from "zod";
import { handle, HttpError, readJson } from "@/lib/api";
import { sendEmail } from "@/lib/email/send";
import { clientId } from "@/lib/rate-limit";
import { scrubText } from "@/lib/forbidden";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const body = z.object({
  to: z.string().min(3).max(200),
  subject: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(20_000),
  type: z.enum(["founder_outreach", "portfolio_followup", "lp_brief", "other"]),
  confirm: z.literal(true, { error: "Please confirm before sending." }),
});

export const POST = handle(async (req: Request) => {
  const b = body.parse(await readJson(req));
  const r = await sendEmail({ to: b.to, subject: scrubText(b.subject), text: scrubText(b.text), type: b.type, callerId: clientId(req) });
  if (!r.ok) throw new HttpError(422, r.message, { status: r.status });
  return Response.json(r);
});
