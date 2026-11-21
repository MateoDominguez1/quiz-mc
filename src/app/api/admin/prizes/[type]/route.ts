import type { NextRequest } from "next/server";
import { errorJson, guardAdmin, handleUnexpected, json, readJson } from "@/lib/http";
import { updatePrize } from "@/lib/services/prizes";
import { fieldErrors, prizeKeySchema, prizeUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/prizes/:type  { label, winMessage, stock } – nome, messaggio e pezzi disponibili. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const denied = await guardAdmin(req);
  if (denied) return denied;

  const { type } = await ctx.params;
  const prize = prizeKeySchema.safeParse(type);
  if (!prize.success) return errorJson(404, "Premio non trovato");

  const parsed = prizeUpdateSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorJson(422, parsed.error.issues[0]?.message ?? "Dati non validi", { fields: fieldErrors(parsed.error) });
  }
  try {
    const ok = await updatePrize(prize.data, parsed.data.label, parsed.data.winMessage, parsed.data.stock);
    if (!ok) return errorJson(404, "Premio non trovato");
    return json({ ok: true });
  } catch (err) {
    return handleUnexpected(err, "PATCH /api/admin/prizes/:type");
  }
}
