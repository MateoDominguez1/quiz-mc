import type { NextRequest } from "next/server";
import { errorJson, guardStaff, handleUnexpected, json, readJson } from "@/lib/http";
import { resetStats } from "@/lib/services/questions";
import { checkRateLimit } from "@/lib/services/rate-limit";
import { resetStatsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/stats/reset  { mode: "all" | "keep_pending", confirm: "AZZERA" }
 * Solo amministratore. Irreversibile: richiede la parola di conferma.
 */
export async function POST(req: NextRequest) {
  const { denied, session } = await guardStaff(req, "admin");
  if (denied) return denied;

  const parsed = resetStatsSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorJson(400, parsed.error.issues[0]?.message ?? "Richiesta non valida");
  }

  try {
    const limit = await checkRateLimit("stats-reset", session.subject, 5, 600);
    if (!limit.allowed) return errorJson(429, "Troppe richieste. Riprova tra qualche minuto.");

    const result = await resetStats(parsed.data.mode === "keep_pending");
    console.info(`[admin] Statistiche azzerate da ${session.subject} (modalità ${parsed.data.mode})`, result);
    return json({ ok: true, result });
  } catch (err) {
    return handleUnexpected(err, "POST /api/admin/stats/reset");
  }
}
