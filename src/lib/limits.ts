import { HttpError } from "@/lib/api";
import { getSettings } from "@/lib/config/store";
import { clientId, DAY, HOUR, hit } from "@/lib/rate-limit";
import { istDay } from "@/lib/time";

/** Ask drawer and AI draft requests: a per-visitor hourly limit plus a total daily cap, both from settings. */
export async function limitAi(req: Request, kind: "ask" | "draft") {
  const s = await getSettings();
  const perIp = await hit(`ai:${clientId(req)}`, HOUR, s.ask_per_ip_per_hour);
  if (!perIp.allowed)
    throw new HttpError(429, `You have used your ${s.ask_per_ip_per_hour} requests for this hour. Please try again in about ${Math.ceil(perIp.retryAfterSec / 60)} minutes.`, { retryAfterSec: perIp.retryAfterSec });
  const day = await hit(`ai-day:${istDay()}`, DAY, s.ask_daily_cap);
  if (!day.allowed) throw new HttpError(429, "The daily limit for this feature has been reached. Please try again tomorrow.");
  void kind;
}
