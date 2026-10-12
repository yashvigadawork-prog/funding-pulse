import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { askWeb } from "@/lib/ask";
import { limitAi } from "@/lib/limits";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Only used when the user presses the clearly labelled "Search the web" button. */
export const POST = handle(async (req: Request) => {
  const { question } = z.object({ question: z.string().trim().min(3).max(300) }).parse(await readJson(req));
  await limitAi(req, "ask");
  return Response.json(await askWeb(question));
});
