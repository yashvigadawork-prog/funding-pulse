import { handle, HttpError } from "@/lib/api";
import { buildDeckHtml, buildDeckPdf } from "@/lib/deck";
import { parseSections } from "@/lib/deck/sections";
import { limitDeckPdf } from "@/lib/deck/limits";
import { clientId, HOUR, hit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The summary deck for one week. `?sections=glance,money` picks the slides (the cover is always included).
 * `?format=html` is the on-screen preview; the default is the PDF. `?dl=1` asks the browser to save it.
 */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ week: string }> }) => {
  const { week } = await ctx.params;
  const url = new URL(req.url);
  const sections = parseSections(url.searchParams.get("sections"));
  if (!sections.length) throw new HttpError(400, "Please tick at least one section for the deck.");

  if (url.searchParams.get("format") === "html") {
    const r = await hit(`deck-html:${clientId(req)}`, HOUR, 120);
    if (!r.allowed) throw new HttpError(429, "Too many previews in the last hour. Please try again a little later.");
    return new Response(await buildDeckHtml(week, sections, true), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }

  // Building a PDF starts a headless browser, so it has its own tighter limits.
  await limitDeckPdf(req);
  const { pdf, filename } = await buildDeckPdf(week, sections);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${url.searchParams.get("dl") === "1" ? "attachment" : "inline"}; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
});
