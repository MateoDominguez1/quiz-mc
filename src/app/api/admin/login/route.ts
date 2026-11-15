import { staffLoginHandler } from "@/lib/auth/staff-routes";

export const dynamic = "force-dynamic";

/** POST /api/admin/login  { username, password } */
export const POST = staffLoginHandler("admin");
