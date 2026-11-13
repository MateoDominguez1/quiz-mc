import type { NextRequest } from "next/server";
import { errorJson, guardAdmin, handleUnexpected, json, readJson } from "@/lib/http";
import { createQuestion, listQuestions } from "@/lib/services/questions";
import { fieldErrors, questionInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/admin/questions – elenco completo (solo amministratore). */
export async function GET(req: NextRequest) {
  const denied = await guardAdmin(req, false);
  if (denied) return denied;
  try {
    return json({ ok: true, questions: await listQuestions() });
  } catch (err) {
    return handleUnexpected(err, "GET /api/admin/questions");
  }
}

/** POST /api/admin/questions – crea una domanda. */
export async function POST(req: NextRequest) {
  const denied = await guardAdmin(req);
  if (denied) return denied;

  const parsed = questionInputSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorJson(422, "Controlla i campi evidenziati.", { fields: fieldErrors(parsed.error) });
  }
  try {
    const question = await createQuestion(parsed.data);
    return json({ ok: true, question }, { status: 201 });
  } catch (err) {
    return handleUnexpected(err, "POST /api/admin/questions");
  }
}
