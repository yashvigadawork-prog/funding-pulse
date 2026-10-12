import { handle, HttpError, limitConfigWrites, readJson } from "@/lib/api";
import { investorSchema } from "@/lib/config/schema";
import { deleteInvestor, updateInvestor } from "@/lib/config/store";

export const dynamic = "force-dynamic";

function parseId(id: string) {
  const n = Number(id);
  if (!Number.isInteger(n)) throw new HttpError(400, "Bad id");
  return n;
}

export const PUT = handle(async (req: Request, ctx: RouteContext<"/api/investors/[id]">) => {
  const id = parseId((await ctx.params).id);
  await limitConfigWrites(req);
  return Response.json(await updateInvestor(id, investorSchema.parse(await readJson(req))));
});

export const DELETE = handle(async (req: Request, ctx: RouteContext<"/api/investors/[id]">) => {
  const id = parseId((await ctx.params).id);
  await limitConfigWrites(req);
  await deleteInvestor(id);
  return Response.json({ ok: true });
});
