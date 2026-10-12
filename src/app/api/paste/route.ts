import { z } from "zod";
import { handle, HttpError, readJson } from "@/lib/api";
import { getBlocks, listCompanies } from "@/lib/config/store";
import { geminiConfigured } from "@/lib/gemini";
import { limitAi } from "@/lib/limits";
import { addPastedArticle } from "@/lib/pipeline/collect";
import { extractPending } from "@/lib/pipeline/extract";
import { processExtracted } from "@/lib/pipeline/process";
import { canonicalUrl } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const body = z.object({
  text: z.string().trim().min(40, "Please paste at least a couple of sentences.").max(12_000, "That is too long. Please paste just the post."),
  url: z.string().trim().url("Please paste the link to the post as well, so every deal keeps a source.").refine((u) => /^https?:\/\//i.test(u), "The link must start with http or https."),
});

/** The paste box: a person pastes a public post (for example from LinkedIn) and its link. Nothing is fetched from LinkedIn. */
export const POST = handle(async (req: Request) => {
  const b = body.parse(await readJson(req));
  await limitAi(req, "draft");
  if (!geminiConfigured()) throw new HttpError(503, "The AI reader is not available right now, so the post could not be read. Please try again later.");
  const url = canonicalUrl(b.url);
  const added = await addPastedArticle({ text: b.text, url, title: `Pasted post: ${b.text.slice(0, 60)}` });
  if (!added) throw new HttpError(409, "That post (or its link) is already stored.");
  const blocks = await getBlocks();
  const ex = await extractPending({ settings: blocks.digest_settings, taxonomy: blocks.taxonomy, deadline: Date.now() + 60_000, limit: 3 });
  const proc = await processExtracted({ blocks, companies: await listCompanies() });
  return Response.json({
    ok: true,
    dealsFound: ex.dealsFound,
    newDeals: proc.inserted,
    merged: proc.merged,
    message:
      ex.dealsFound === 0
        ? "Saved, but no funding deal was found in that text."
        : `Found ${ex.dealsFound} deal${ex.dealsFound === 1 ? "" : "s"} (${proc.inserted} new, ${proc.merged} merged with existing). It shows on the dashboard after the next refresh.`,
  });
});
