import type { NextRequest } from "next/server";
import { errorJson, guardAdmin, handleUnexpected, json, readJson } from "@/lib/http";
import { deleteQuestion, getQuestion, updateQuestion } from "@/lib/services/questions";
import { fieldErrors, questionInputSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function resolveId(ctx: Ctx): Promise<string | null> {
  const { id } = await ctx.params;
  return uuidSchema.safeParse(id).success ? id : null;
}

/** GET /api/admin/questions/:id */
export async function GET(req: NextRequest, ctx: Ctx) {
  const denied = await guardAdmin(req, false);
  if (denied) return denied;
  const id = await resolveId(ctx);
  if (!id) return errorJson(400, "Identificativo non valido");
  try {
    const question = await getQuestion(id);
    if (!question) return errorJson(404, "Domanda non trovata");
    return json({ ok: true, question });
  } catch (err) {
    return handleUnexpected(err, "GET /api/admin/questions/:id");
  }
}

/** PUT /api/admin/questions/:id – modifica completa. */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const id = await resolveId(ctx);
  if (!id) return errorJson(400, "Identificativo non valido");

  const parsed = questionInputSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorJson(422, "Controlla i campi evidenziati.", { fields: fieldErrors(parsed.error) });
  }
  try {
    const question = await updateQuestion(id, parsed.data);
    if (!question) return errorJson(404, "Domanda non trovata");
    return json({ ok: true, question });
  } catch (err) {
    return handleUnexpected(err, "PUT /api/admin/questions/:id");
  }
}

/** DELETE /api/admin/questions/:id */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const id = await resolveId(ctx);
  if (!id) return errorJson(400, "Identificativo non valido");
  try {
    const deleted = await deleteQuestion(id);
    if (!deleted) return errorJson(404, "Domanda non trovata");
    return json({ ok: true });
  } catch (err) {
    return handleUnexpected(err, "DELETE /api/admin/questions/:id");
  }
}
