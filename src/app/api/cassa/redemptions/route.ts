import type { NextRequest } from "next/server";
import { guardStaff, handleUnexpected, json } from "@/lib/http";
import { listRedemptions } from "@/lib/services/cassa";

export const dynamic = "force-dynamic";

/** GET /api/cassa/redemptions – storico riscossioni. */
export async function GET(req: NextRequest) {
  const { denied } = await guardStaff(req, "cassa", false);
  if (denied) return denied;
  try {
    return json({ ok: true, ...(await listRedemptions(100)) });
  } catch (err) {
    return handleUnexpected(err, "GET /api/cassa/redemptions");
  }
}
