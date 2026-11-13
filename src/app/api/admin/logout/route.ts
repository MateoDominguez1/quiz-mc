import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions } from "@/lib/auth/token";
import { errorJson, isSameOrigin, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** POST /api/admin/logout */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return errorJson(403, "Richiesta non consentita");
  }
  const res = json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", adminCookieOptions(0));
  return res;
}
