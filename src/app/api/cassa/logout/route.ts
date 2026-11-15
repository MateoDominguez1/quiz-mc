import { staffLogoutHandler } from "@/lib/auth/staff-routes";

export const dynamic = "force-dynamic";

/** POST /api/cassa/logout */
export const POST = staffLogoutHandler("cassa");
