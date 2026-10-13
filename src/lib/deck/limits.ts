import "server-only";
import { HttpError } from "@/lib/api";
import { clientId, DAY, HOUR, hit } from "@/lib/rate-limit";

/** Building a PDF starts a headless browser, so each visitor gets a small hourly allowance and the site a daily cap. */
export async function limitDeckPdf(req: Request) {
  const perVisitor = await hit(`deck-pdf:${clientId(req)}`, HOUR, 12);
  const overall = await hit("deck-pdf-day", DAY, 200);
  if (!perVisitor.allowed || !overall.allowed) throw new HttpError(429, "The summary deck limit has been reached for now. Please try again in a while.");
}
