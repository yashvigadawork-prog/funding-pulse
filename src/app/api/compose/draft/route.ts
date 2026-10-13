import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { getBlocks } from "@/lib/config/store";
import { escapeForTag, geminiConfigured, geminiJson, UNTRUSTED_NOTICE } from "@/lib/gemini";
import { limitAi } from "@/lib/limits";
import { scrubDeep } from "@/lib/forbidden";
import { numbersAreGrounded } from "@/lib/pipeline/analyse";
import { bulletCount, joinDraft, notEnoughChange, splitDraft } from "@/lib/actions/rewrite";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({
  subject: z.string().max(200).default(""),
  body: z.string().min(10).max(8000),
  kind: z.enum(["email", "linkedin"]).default("email"),
  instruction: z.string().max(200).optional(),
  /** The two quick rewrites in the compose drawer. */
  mode: z.enum(["improve", "warmer", "shorter"]).default("improve"),
});
/** Words from inside the tool that must never reach a reader outside the fund. */
const JARGON = /on radar|investor of interest|first time we have seen|focus deal|needs review/i;
const answer = z.object({ subject: z.string().default(""), body: z.string().min(5) });

const STYLE = {
  improve: "Tidy the wording so it reads like a thoughtful person wrote it. Keep the structure.",
  warmer:
    "Rewrite it so it sounds clearly warmer and more personal. Change the wording of most sentences: friendlier, more conversational phrasing, real enthusiasm about the specific news, speaking directly to the reader. Do not make it more than about 15% longer.",
  shorter: "Cut it to about 60% of its length: keep only the key facts and the ask, merge sentences, drop pleasantries. Keep every bullet that carries a number.",
} as const;

/** "Improve with AI", "Rewrite warmer", "Shorter": rewrites the body of a draft without adding any new fact. The greeting and sign-off are kept exactly. */
export const POST = handle(async (req: Request) => {
  const b = body.parse(await readJson(req));
  await limitAi(req, "draft");
  if (!geminiConfigured()) return Response.json({ ok: false, message: "AI drafting is not available right now. Your draft is unchanged." });
  const sender = (await getBlocks()).sender_profile;
  const parts = splitDraft(b.body);
  // LinkedIn notes and very short drafts have no greeting/sign-off to protect, so the whole text is rewritten.
  const whole = b.kind === "linkedin" || !parts.middle || parts.middle.length < 40;
  const input = whole ? b.body : parts.middle;
  const urls: string[] = input.match(/https?:\/\/[^\s)]+/g) ?? [];

  const attempt = async (hint: string): Promise<{ subject: string; text: string } | { problem: string }> => {
    const out = await geminiJson({
      system: [
        `You rewrite short messages for ${sender.name}, ${sender.title} at ${sender.organisation}. Tone: ${sender.outreach_tone}`,
        UNTRUSTED_NOTICE,
        "Voice: first person, written as the sender; warm, personal, brief and polished. Plain words only. Never use internal labels such as On Radar, investor of interest, focus deal or portfolio tags. Keep every bullet point the draft already has (you may tighten its wording) and never add new bullets.",
        "Rules: keep every fact, number, name and web address exactly as given. Add no new facts, claims, promises, investment commitments or numbers. Do not add a greeting or a sign-off. Keep paragraph breaks as blank lines, keep bullet lines starting with •, and keep any web address on its own line exactly as written.",
        b.kind === "linkedin" ? "This is a LinkedIn connection note: at most 300 characters." : "This is an email.",
        STYLE[b.mode],
        hint,
      ]
        .filter(Boolean)
        .join("\n"),
      prompt: `<source>${escapeForTag(input)}</source>\n${b.subject ? `Subject line (rewrite it only if the mode needs it, otherwise return it unchanged): ${escapeForTag(b.subject)}\n` : ""}${b.instruction ? `Extra instruction from the user (about style only): ${escapeForTag(b.instruction)}\n` : ""}Rewrite the text now.`,
      jsonSchema: { type: "object", properties: { subject: { type: "string" }, body: { type: "string" } }, required: ["subject", "body"] },
      schema: answer,
      maxOutputTokens: 1500,
    });
    const text = out.body.trim();
    const newUrls = text.match(/https?:\/\/[^\s)]+/g) ?? [];
    if (newUrls.some((u) => !urls.includes(u)) || urls.some((u) => !text.includes(u))) return { problem: "it changed a link" };
    if (!numbersAreGrounded(text, input).ok) return { problem: "it changed a number" };
    if (JARGON.test(text)) return { problem: "it used an internal label" };
    if (b.kind === "linkedin" && text.length > 300) return { problem: "it was too long for LinkedIn" };
    if (!whole && bulletCount(input) > 0 && bulletCount(text) === 0) return { problem: "it dropped the bullet list" };
    const same = notEnoughChange(b.mode, input, text);
    if (same) return { problem: same };
    return { subject: out.subject.trim() || b.subject, text };
  };

  try {
    const first = await attempt("");
    const r = "problem" in first ? await attempt(`Your previous answer was rejected because ${first.problem}. Try again and fix exactly that.`) : first;
    if ("problem" in r) return Response.json({ ok: false, message: `The AI version was not used because ${r.problem}. Your draft is unchanged. Please try again.` });
    const full = whole ? r.text : joinDraft({ ...parts, middle: r.text });
    return Response.json(scrubDeep({ ok: true, subject: b.mode === "improve" || b.mode === "warmer" ? r.subject : b.subject, body: full }));
  } catch {
    return Response.json({ ok: false, message: "AI drafting is unavailable right now. Your draft is unchanged. Please try again in a minute." });
  }
});
