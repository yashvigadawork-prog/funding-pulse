import { handle } from "@/lib/api";
import { recentSends } from "@/lib/email/send";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const rows = await recentSends(15);
  return Response.json(rows.map((r) => ({ id: r.id, recipient: r.recipient, type: r.type, subject: r.subject, status: r.status, error: r.error, sentAt: r.sentAt })));
});
