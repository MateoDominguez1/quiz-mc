import "server-only";
import { getSession } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/validation";

/** ID della partita in corso sul dispositivo (cookie httpOnly firmato), o null. */
export async function getCurrentGameId(): Promise<string | null> {
  const session = await getSession("game");
  if (!session) return null;
  return uuidSchema.safeParse(session.subject).success ? session.subject : null;
}

/** Ristorante scelto su questo dispositivo (cookie firmato), o null. */
export async function getCurrentRestaurant(): Promise<string | null> {
  const session = await getSession("restaurant");
  if (!session) return null;
  return /^[a-z0-9-]{2,30}$/.test(session.subject) ? session.subject : null;
}
