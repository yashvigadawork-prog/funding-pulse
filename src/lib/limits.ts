import { HttpError } from "@/lib/api";
import { getSettings } from "@/lib/config/store";
import { clientId, DAY, HOUR, hit } from "@/lib/rate-limit";
import { istDay } from "@/lib/time";

/**
 * Ask drawer and AI draft requests: a per-visitor hourly limit plus a total daily cap, both from settings.
 * Drafting has its own counters and three times the hourly allowance, because one email can take several rewrites.
 */
export async function limitAi(req: Request, kind: "ask" | "draft") {
  const s = await getSettings();
  const perHour = kind === "draft" ? s.ask_per_ip_per_hour * 3 : s.ask_per_ip_per_hour;
  const perIp = await hit(`${kind === "draft" ? "draft" : "ai"}:${clientId(req)}`, HOUR, perHour);
  if (!perIp.allowed)
    throw new HttpError(429, `You have used your ${perHour} ${kind === "draft" ? "rewrites" : "requests"} for this hour. Please try again in about ${Math.ceil(perIp.retryAfterSec / 60)} minutes.`, { retryAfterSec: perIp.retryAfterSec });
  const day = await hit(`${kind === "draft" ? "draft-day" : "ai-day"}:${istDay()}`, DAY, s.ask_daily_cap);
  if (!day.allowed) throw new HttpError(429, "The daily limit for this feature has been reached. Please try again tomorrow.");
}
