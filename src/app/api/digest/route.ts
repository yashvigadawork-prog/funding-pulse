import { handle } from "@/lib/api";
import { loadDigestView } from "@/lib/digest-view";
import { ensureSeeded } from "@/lib/config/store";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await ensureSeeded();
  const week = new URL(req.url).searchParams.get("week");
  return Response.json(await loadDigestView(week));
});
