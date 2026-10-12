import { handle, limitConfigWrites, readJson } from "@/lib/api";
import { importConfig } from "@/lib/config/store";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  await limitConfigWrites(req);
  const counts = await importConfig(await readJson(req));
  return Response.json({ ok: true, ...counts });
});
