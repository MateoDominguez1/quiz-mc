import type { NextRequest } from "next/server";
import { errorJson, guardStaff, handleUnexpected, json, readJson } from "@/lib/http";
import { lookupPrize } from "@/lib/services/cassa";
import { checkRateLimit } from "@/lib/services/rate-limit";
import { prizeCodeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** POST /api/cassa/prizes/lookup  { code } – verifica senza modificare nulla. */
export async function POST(req: NextRequest) {
  const { denied, session } = await guardStaff(req, "cassa");
  if (denied) return denied;
  const parsed = prizeCodeSchema.safeParse(await readJson(req));
  if (!parsed.success) return errorJson(400, parsed.error.issues[0]?.message ?? "Codice non valido");
  try {
    const limit = await checkRateLimit("prize-lookup", session.subject, 120, 60);
    if (!limit.allowed) return errorJson(429, "Troppe verifiche. Attendi qualche secondo.");
    return json({ ok: true, result: await lookupPrize(parsed.data.code) });
  } catch (err) {
    return handleUnexpected(err, "POST /api/cassa/prizes/lookup");
  }
}
