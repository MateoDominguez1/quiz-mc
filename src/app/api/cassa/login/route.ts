import { staffLoginHandler } from "@/lib/auth/staff-routes";

export const dynamic = "force-dynamic";

/** POST /api/cassa/login  { username, password } */
export const POST = staffLoginHandler("cassa");
