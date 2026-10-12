import { handle, limitConfigWrites, readJson } from "@/lib/api";
import { companyInputSchema } from "@/lib/config/schema";
import { deleteCompany, updateCompany } from "@/lib/config/store";

export const dynamic = "force-dynamic";

export const PUT = handle(async (req: Request, ctx: RouteContext<"/api/companies/[id]">) => {
  const { id } = await ctx.params;
  await limitConfigWrites(req);
  return Response.json(await updateCompany(id, companyInputSchema.parse(await readJson(req))));
});

export const DELETE = handle(async (req: Request, ctx: RouteContext<"/api/companies/[id]">) => {
  const { id } = await ctx.params;
  await limitConfigWrites(req);
  await deleteCompany(id);
  return Response.json({ ok: true });
});
