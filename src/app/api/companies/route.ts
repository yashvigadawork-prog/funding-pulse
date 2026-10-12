import { handle, limitConfigWrites, readJson } from "@/lib/api";
import { companyInputSchema } from "@/lib/config/schema";
import { createCompany, listCompanies } from "@/lib/config/store";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const tag = new URL(req.url).searchParams.get("tag");
  return Response.json(await listCompanies(tag === "Portfolio" || tag === "On Radar" ? tag : undefined));
});

export const POST = handle(async (req: Request) => {
  await limitConfigWrites(req);
  const input = companyInputSchema.parse(await readJson(req));
  return Response.json(await createCompany(input), { status: 201 });
});
