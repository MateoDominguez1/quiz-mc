import type { NextRequest } from "next/server";
import { errorJson, guardStaff, handleUnexpected, json } from "@/lib/http";
import { cancelEntry, getEntryState } from "@/lib/services/cassa";
import { uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/cassa/entries/:id – stato del QR (per sapere quando il cliente lo ha usato). */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { denied } = await guardStaff(req, "cassa", false);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return errorJson(400, "Identificativo non valido");
  try {
    const state = await getEntryState(id);
    if (!state) return errorJson(404, "QR non trovato");
    return json({ ok: true, ...state });
  } catch (err) {
    return handleUnexpected(err, "GET /api/cassa/entries/:id");
  }
}

/** DELETE /api/cassa/entries/:id – annulla un QR non ancora utilizzato. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { denied } = await guardStaff(req, "cassa");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return errorJson(400, "Identificativo non valido");
  try {
    const cancelled = await cancelEntry(id);
    return json({ ok: true, cancelled });
  } catch (err) {
    return handleUnexpected(err, "DELETE /api/cassa/entries/:id");
  }
}
