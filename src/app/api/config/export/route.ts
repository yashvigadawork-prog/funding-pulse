import { handle } from "@/lib/api";
import { getFullConfig } from "@/lib/config/store";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const cfg = await getFullConfig();
  return new Response(JSON.stringify(cfg, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="funding-pulse-config.json"',
    },
  });
});
