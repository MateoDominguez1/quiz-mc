import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/**
 * Protezione ottimistica delle aree del personale (/admin e /cassa).
 * La verifica definitiva avviene comunque in ogni pagina e API.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = pathname.startsWith("/cassa") ? "cassa" : "admin";
  const base = `/${role}`;
  const home = role === "admin" ? "/admin/dashboard" : "/cassa/dashboard";

  let session = null;
  try {
    session = await verifySession(role, req.cookies.get(SESSION_COOKIE[role])?.value);
  } catch {
    session = null; // configurazione mancante: trattato come non autenticato
  }

  const isLoginPage = pathname === base || pathname === `${base}/`;
  if (isLoginPage && session) {
    return NextResponse.redirect(new URL(home, req.url));
  }
  if (!isLoginPage && !session) {
    return NextResponse.redirect(new URL(base, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/cassa", "/cassa/:path*"],
};
