import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { errorJson, getPublicOrigin, guardStaff, handleUnexpected, json } from "@/lib/http";
import { createEntry } from "@/lib/services/cassa";
import { checkRateLimit } from "@/lib/services/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/cassa/entries – "Pagamento ricevuto": genera un QR monouso.
 * Il token in chiaro esiste solo nella risposta (e nel QR); nel DB c'è l'hash.
 */
export async function POST(req: NextRequest) {
  const { denied, session } = await guardStaff(req, "cassa");
  if (denied) return denied;
  try {
    const limit = await checkRateLimit("entry-create", session.subject, 120, 60);
    if (!limit.allowed) {
      return errorJson(429, "Troppe richieste. Attendi qualche secondo.");
    }
    const entry = await createEntry(session.subject);
    const url = `${getPublicOrigin(req)}/q/${entry.token}`;
    const svg = await QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
    return json({ ok: true, id: entry.id, url, svg, expiresAt: entry.expiresAt }, { status: 201 });
  } catch (err) {
    return handleUnexpected(err, "POST /api/cassa/entries");
  }
}
