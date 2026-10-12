import { handle, HttpError, limitConfigWrites, readJson } from "@/lib/api";
import { getBlocks, isConfigBlock, saveBlock } from "@/lib/config/store";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/config/[block]">) => {
  const { block } = await ctx.params;
  if (!isConfigBlock(block)) throw new HttpError(404, "Unknown settings section");
  return Response.json((await getBlocks())[block]);
});

export const PUT = handle(async (req: Request, ctx: RouteContext<"/api/config/[block]">) => {
  const { block } = await ctx.params;
  if (!isConfigBlock(block)) throw new HttpError(404, "Unknown settings section");
  await limitConfigWrites(req);
  const saved = await saveBlock(block, await readJson(req));
  return Response.json(saved);
});
