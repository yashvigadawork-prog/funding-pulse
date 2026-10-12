import { handle, limitConfigWrites } from "@/lib/api";
import { loadSeed, resetToDefaults } from "@/lib/config/store";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  await limitConfigWrites(req);
  await resetToDefaults();
  const s = loadSeed();
  return Response.json({ ok: true, portfolio: s.portfolio.length, on_radar: s.on_radar.length });
});
