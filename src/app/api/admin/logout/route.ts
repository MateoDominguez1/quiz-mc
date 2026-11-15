import { staffLogoutHandler } from "@/lib/auth/staff-routes";

export const dynamic = "force-dynamic";

/** POST /api/admin/logout */
export const POST = staffLogoutHandler("admin");
