import type { NextRequest } from "next/server";
import { errorJson, guardAdmin, handleUnexpected, json } from "@/lib/http";
import { MAX_IMAGE_BYTES, detectImageType, replacePrizeImage } from "@/lib/services/prizes";
import { prizeKeySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/prizes/:type/image  (multipart, campo "file")
 * La foto viene già ridimensionata nel browser; il server verifica formato
 * reale (JPEG/PNG/WebP) e dimensione prima di caricarla su Supabase Storage.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const denied = await guardAdmin(req);
  if (denied) return denied;

  const { type } = await ctx.params;
  const prize = prizeKeySchema.safeParse(type);
  if (!prize.success) return errorJson(404, "Premio non trovato");

  let file: File | null = null;
  try {
    const form = await req.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    file = null;
  }
  if (!file || file.size === 0) return errorJson(400, "Seleziona una foto.");
  if (file.size > MAX_IMAGE_BYTES) return errorJson(413, "La foto è troppo grande (massimo 3 MB).");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!detectImageType(bytes)) return errorJson(415, "Formato non supportato. Usa JPG, PNG o WebP.");

  try {
    const imageUrl = await replacePrizeImage(prize.data, bytes);
    return json({ ok: true, imageUrl });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Caricamento foto non riuscito")) {
      console.error("[prize image]", err.message);
      return errorJson(502, "Caricamento non riuscito. Verifica che il bucket \"prize-images\" esista su Supabase.");
    }
    return handleUnexpected(err, "POST /api/admin/prizes/:type/image");
  }
}
