import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/auth/token";

/**
 * Protezione ottimistica delle rotte /admin.
 * La verifica definitiva avviene comunque in ogni pagina e API (requireAdminPage/guardAdmin).
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  let session = null;
  try {
    session = await verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  } catch {
    session = null; // configurazione mancante: trattato come non autenticato
  }

  const isLoginPage = pathname === "/admin" || pathname === "/admin/";

  if (isLoginPage && session) {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }
  if (!isLoginPage && !session) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
