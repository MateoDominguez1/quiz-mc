import type { NextRequest } from "next/server";
import { guardAdmin, handleUnexpected, json } from "@/lib/http";
import { listPrizeSettings } from "@/lib/services/prizes";

export const dynamic = "force-dynamic";

/** GET /api/admin/prizes – premi e foto attuali. */
export async function GET(req: NextRequest) {
  const denied = await guardAdmin(req, false);
  if (denied) return denied;
  try {
    return json({ ok: true, prizes: await listPrizeSettings() });
  } catch (err) {
    return handleUnexpected(err, "GET /api/admin/prizes");
  }
}
