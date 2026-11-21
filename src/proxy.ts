import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/**
 * Protezione ottimistica delle aree riservate:
 *  - /admin → pannello amministratore;
 *  - /      → il quiz, giocabile solo sul dispositivo abilitato (login in /postazione).
 * La verifica definitiva avviene comunque in ogni pagina e API.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdmin = pathname.startsWith("/admin");
  const role = isAdmin ? "admin" : "postazione";
  const loginPage = isAdmin ? "/admin" : "/postazione";
  const home = isAdmin ? "/admin/dashboard" : "/";

  let session = null;
  try {
    session = await verifySession(role, req.cookies.get(SESSION_COOKIE[role])?.value);
  } catch {
    session = null; // configurazione mancante: trattato come non autenticato
  }

  const isLoginPage = pathname === loginPage || pathname === `${loginPage}/`;
  if (isLoginPage && session) {
    return NextResponse.redirect(new URL(home, req.url));
  }
  if (!isLoginPage && !session) {
    return NextResponse.redirect(new URL(loginPage, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/postazione", "/admin", "/admin/:path*"],
};
