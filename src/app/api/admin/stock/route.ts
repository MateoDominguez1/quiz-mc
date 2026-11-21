import type { NextRequest } from "next/server";
import { errorJson, guardAdmin, handleUnexpected, json, readJson } from "@/lib/http";
import { setStock } from "@/lib/services/prizes";
import { fieldErrors, stockUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** PUT /api/admin/stock  { restaurant, prize, stock } – pezzi disponibili di un premio in un ristorante. */
export async function PUT(req: NextRequest) {
  const denied = await guardAdmin(req);
  if (denied) return denied;

  const parsed = stockUpdateSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorJson(422, parsed.error.issues[0]?.message ?? "Dati non validi", { fields: fieldErrors(parsed.error) });
  }
  try {
    const ok = await setStock(parsed.data.restaurant, parsed.data.prize, parsed.data.stock);
    if (!ok) return errorJson(404, "Ristorante o premio non trovato");
    return json({ ok: true });
  } catch (err) {
    return handleUnexpected(err, "PUT /api/admin/stock");
  }
}
