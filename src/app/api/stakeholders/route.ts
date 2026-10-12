import { handle, limitConfigWrites, readJson } from "@/lib/api";
import { stakeholderSchema } from "@/lib/config/schema";
import { createStakeholder, listStakeholders } from "@/lib/config/store";

export const dynamic = "force-dynamic";

export const GET = handle(async () => Response.json(await listStakeholders()));

export const POST = handle(async (req: Request) => {
  await limitConfigWrites(req);
  return Response.json(await createStakeholder(stakeholderSchema.parse(await readJson(req))), { status: 201 });
});
