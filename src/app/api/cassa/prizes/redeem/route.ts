import type { NextRequest } from "next/server";
import { errorJson, guardStaff, handleUnexpected, json, readJson } from "@/lib/http";
import { redeemPrize } from "@/lib/services/cassa";
import { prizeCodeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/cassa/prizes/redeem  { code } – "Conferma consegna".
 * Il DB riverifica lo stato e riscatta in modo atomico: due operatori
 * simultanei non possono riscattare lo stesso codice.
 */
export async function POST(req: NextRequest) {
  const { denied, session } = await guardStaff(req, "cassa");
  if (denied) return denied;
  const parsed = prizeCodeSchema.safeParse(await readJson(req));
  if (!parsed.success) return errorJson(400, parsed.error.issues[0]?.message ?? "Codice non valido");
  try {
    return json({ ok: true, result: await redeemPrize(parsed.data.code, session.subject) });
  } catch (err) {
    return handleUnexpected(err, "POST /api/cassa/prizes/redeem");
  }
}
