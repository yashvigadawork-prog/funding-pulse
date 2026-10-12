import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { getBlocks } from "@/lib/config/store";
import { escapeForTag, geminiConfigured, geminiJson, UNTRUSTED_NOTICE } from "@/lib/gemini";
import { limitAi } from "@/lib/limits";
import { numbersAreGrounded } from "@/lib/pipeline/analyse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({
  subject: z.string().max(200).default(""),
  body: z.string().min(10).max(8000),
  kind: z.enum(["email", "linkedin"]).default("email"),
  instruction: z.string().max(200).optional(),
});
const answer = z.object({ subject: z.string().default(""), body: z.string().min(5) });

/** "Improve with AI": rewrites a draft in the sender's tone without adding any new fact. */
export const POST = handle(async (req: Request) => {
  const b = body.parse(await readJson(req));
  await limitAi(req, "draft");
  if (!geminiConfigured()) return Response.json({ ok: false, message: "AI drafting is not available right now. Your draft is unchanged." });
  const sender = (await getBlocks()).sender_profile;
  const urls = (b.body.match(/https?:\/\/[^\s)]+/g) ?? []).join(" ");
  try {
    const out = await geminiJson({
      system: [
        `You polish short outreach messages for ${sender.name}, ${sender.title} at ${sender.organisation}. Tone: ${sender.outreach_tone}`,
        UNTRUSTED_NOTICE,
        "Rules: keep every fact, number, name and web address exactly as in the draft. Add no new facts, claims, promises or numbers. Keep it brief and specific. Keep the greeting and sign-off.",
        b.kind === "linkedin" ? "This is a LinkedIn connection note: at most 300 characters." : "This is an email.",
      ].join("\n"),
      prompt: `<source>${escapeForTag(`Subject: ${b.subject}\n\n${b.body}`)}</source>\n${b.instruction ? `Extra instruction from the user (about style only): ${escapeForTag(b.instruction)}\n` : ""}Rewrite the draft.`,
      jsonSchema: { type: "object", properties: { subject: { type: "string" }, body: { type: "string" } }, required: ["subject", "body"] },
      schema: answer,
      maxOutputTokens: 1500,
    });
    const newUrls = out.body.match(/https?:\/\/[^\s)]+/g) ?? [];
    const lostOrNewUrl = newUrls.some((u) => !urls.includes(u)) || (b.body.match(/https?:\/\/[^\s)]+/g) ?? []).some((u) => !out.body.includes(u));
    const nums = numbersAreGrounded(out.body, b.body);
    if (lostOrNewUrl || !nums.ok || (b.kind === "linkedin" && out.body.length > 300))
      return Response.json({ ok: false, message: "The AI version changed facts or links, so it was not used. Your draft is unchanged." });
    return Response.json({ ok: true, subject: out.subject || b.subject, body: out.body });
  } catch {
    return Response.json({ ok: false, message: "AI drafting is unavailable right now. Your draft is unchanged." });
  }
});
