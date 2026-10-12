import { ZodError } from "zod";
import { clientId, hit, HOUR } from "@/lib/rate-limit";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function plainZodMessage(e: ZodError): string {
  return e.issues
    .slice(0, 4)
    .map((i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`)
    .join("; ");
}

/** Wraps a route so errors become short plain-language JSON instead of stack traces. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message, ...e.extra }, { status: e.status });
      if (e instanceof ZodError) return Response.json({ error: plainZodMessage(e) }, { status: 400 });
      const msg = e instanceof Error ? e.message : "Something went wrong";
      console.error("[api]", msg);
      const known = /already exists|already on the list|already in the address|not found|Duplicate/i.test(msg);
      return Response.json({ error: known ? msg : "Something went wrong on our side. Please try again." }, { status: known ? 400 : 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "That request was not valid JSON");
  }
}

/** Public config edits are open to everyone, so each caller gets a generous hourly allowance. */
export async function limitConfigWrites(req: Request) {
  const r = await hit(`cfg:${clientId(req)}`, HOUR, 400);
  if (!r.allowed) throw new HttpError(429, "Too many edits in the last hour. Please wait a little and try again.");
}
