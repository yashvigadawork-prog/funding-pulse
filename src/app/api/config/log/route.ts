import { handle } from "@/lib/api";
import { listEditLog } from "@/lib/config/store";

export const dynamic = "force-dynamic";

export const GET = handle(async () => Response.json(await listEditLog(100)));
