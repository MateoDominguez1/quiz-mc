import type { NextRequest } from "next/server";
import { errorJson, guardAdmin, handleUnexpected, json, readJson } from "@/lib/http";
import { setQuestionActive } from "@/lib/services/questions";
import { statusInputSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/questions/:id/status  { isActive: boolean } */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guardAdmin(req);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return errorJson(400, "Identificativo non valido");

  const parsed = statusInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return errorJson(400, "Stato non valido");

  try {
    const question = await setQuestionActive(id, parsed.data.isActive);
    if (!question) return errorJson(404, "Domanda non trovata");
    return json({ ok: true, question });
  } catch (err) {
    return handleUnexpected(err, "PATCH /api/admin/questions/:id/status");
  }
}
