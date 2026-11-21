import { staffLogoutHandler } from "@/lib/auth/staff-routes";

export const dynamic = "force-dynamic";

/** POST /api/postazione/logout – disabilita il dispositivo. */
export const POST = staffLogoutHandler("postazione");
