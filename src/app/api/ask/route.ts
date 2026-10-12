import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { askStored } from "@/lib/ask";
import { limitAi } from "@/lib/limits";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = handle(async (req: Request) => {
  const { question } = z.object({ question: z.string().trim().min(3, "Please type a question.").max(300, "Please keep the question under 300 characters.") }).parse(await readJson(req));
  await limitAi(req, "ask");
  return Response.json(await askStored(question));
});
