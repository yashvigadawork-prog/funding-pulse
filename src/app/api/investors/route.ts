import { handle, limitConfigWrites, readJson } from "@/lib/api";
import { investorSchema } from "@/lib/config/schema";
import { createInvestor, listInvestors } from "@/lib/config/store";

export const dynamic = "force-dynamic";

export const GET = handle(async () => Response.json(await listInvestors()));

export const POST = handle(async (req: Request) => {
  await limitConfigWrites(req);
  return Response.json(await createInvestor(investorSchema.parse(await readJson(req))), { status: 201 });
});
