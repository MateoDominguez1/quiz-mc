"use client";

import {
  ExternalLink,
  Gift,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PlusCircle,
  QrCode,
  TicketCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ToastProvider } from "@/components/admin/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/client/api";

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Prefisso che rende attiva la voce anche nelle sottopagine. */
  match?: (pathname: string) => boolean;
}

const VARIANTS: Record<"admin" | "cassa", { title: string; nav: NavItem[] }> = {
  admin: {
    title: "Amministrazione",
    nav: [
      { href: "/admin/dashboard", label: "Dashboard", short: "Dashboard", icon: LayoutDashboard },
      {
        href: "/admin/domande",
        label: "Gestione delle domande",
        short: "Domande",
        icon: ListChecks,
        match: (p) => p === "/admin/domande" || (p.startsWith("/admin/domande/") && !p.endsWith("/nuova")),
      },
      { href: "/admin/domande/nuova", label: "Nuova domanda", short: "Nuova", icon: PlusCircle },
      { href: "/admin/premi", label: "Premi", short: "Premi", icon: Gift },
    ],
  },
  cassa: {
    title: "Cassa",
    nav: [
      { href: "/cassa/dashboard", label: "Inizio", short: "Inizio", icon: LayoutDashboard },
      { href: "/cassa/nuova", label: "Nuova partecipazione", short: "Nuovo QR", icon: QrCode },
      { href: "/cassa/riscatta", label: "Riscatta un premio", short: "Riscatta", icon: TicketCheck },
      { href: "/cassa/storico", label: "Storico riscossioni", short: "Storico", icon: History },
    ],
  },
};

export function PanelShell({
  variant,
  username,
  children,
}: {
  variant: "admin" | "cassa";
  username: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const { title, nav } = VARIANTS[variant];
  const isActive = (item: NavItem) => (item.match ? item.match(pathname) : pathname === item.href);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await apiFetch(`/api/${variant}/logout`, { method: "POST", body: {} });
    router.replace(`/${variant}`);
    router.refresh();
  }

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-neutral-100 lg:flex">
        {/* Sidebar desktop */}
        <aside className="hidden w-72 shrink-0 flex-col bg-ink text-white lg:sticky lg:top-0 lg:flex lg:h-dvh">
          <div className="flex flex-col gap-2 border-b border-white/10 px-6 py-6">
            <BrandLogo size="sm" className="self-start" />
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">{title}</p>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4" aria-label={`Navigazione ${title.toLowerCase()}`}>
            {nav.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-12 items-center gap-3 rounded-xl px-4 font-bold transition ${
                    active ? "bg-brand-yellow text-ink" : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
            {variant === "admin" && (
              <a
                href="/"
                target="_blank"
                rel="noopener"
                className="flex h-12 items-center gap-3 rounded-xl px-4 font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <ExternalLink className="size-5" aria-hidden />
                Apri il quiz
              </a>
            )}
          </nav>
          <div className="border-t border-white/10 p-4">
            <p className="mb-3 truncate px-2 text-sm text-white/60">
              Accesso come <span className="font-bold text-white">{username}</span>
            </p>
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white/10 font-bold transition hover:bg-brand-red disabled:opacity-60"
            >
              {loggingOut ? <Spinner /> : <LogOut className="size-5" aria-hidden />}
              Esci
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Barra superiore mobile/tablet */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-ink px-4 pb-3 pt-[calc(var(--safe-top)+12px)] text-white lg:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo size="sm" />
              <span className="truncate text-xs font-extrabold uppercase tracking-[0.15em] text-brand-yellow">{title}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="flex h-11 items-center gap-2 rounded-xl bg-white/10 px-3 font-bold"
            >
              {loggingOut ? <Spinner /> : <LogOut className="size-5" aria-hidden />}
              Esci
            </button>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(var(--safe-bottom)+96px)] pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
            {children}
          </main>

          {/* Navigazione inferiore (utilizzabile con il pollice) */}
          <nav
            className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-neutral-200 bg-white pb-[var(--safe-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:hidden"
            aria-label={`Navigazione ${title.toLowerCase()}`}
          >
            {nav.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-extrabold ${
                    active ? "text-brand-red" : "text-ink-soft"
                  }`}
                >
                  <Icon className="size-6" aria-hidden />
                  {item.short}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </ToastProvider>
  );
}
