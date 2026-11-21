import { staffLoginHandler } from "@/lib/auth/staff-routes";

export const dynamic = "force-dynamic";

/** POST /api/postazione/login – abilita il dispositivo su cui giocano i clienti. */
export const POST = staffLoginHandler("postazione");
