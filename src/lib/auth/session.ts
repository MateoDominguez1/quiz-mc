import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type Session, type SessionRole } from "@/lib/auth/token";

/** Sessione corrente per un ruolo (Server Components / Route Handlers). */
export async function getSession(role: SessionRole): Promise<Session | null> {
  const store = await cookies();
  return verifySession(role, store.get(SESSION_COOKIE[role])?.value);
}

/** Per le pagine protette del personale: reindirizza al login se non autenticato. */
export async function requireStaffPage(role: "admin" | "postazione"): Promise<Session> {
  const session = await getSession(role);
  if (!session) redirect(role === "admin" ? "/admin" : "/postazione");
  return session;
}
