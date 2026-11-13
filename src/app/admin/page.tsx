import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accesso amministratore – Il Quiz del Giorno",
};

export default async function AdminLoginPage() {
  let session = null;
  try {
    session = await getAdminSession();
  } catch {
    session = null;
  }
  if (session) redirect("/admin/dashboard");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-mc-red to-mc-red-dark px-4 py-10 pt-[calc(var(--safe-top)+2.5rem)] pb-[calc(var(--safe-bottom)+2.5rem)]">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandLogo size="md" />
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-mc-yellow">Il Quiz del Giorno</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          <h1 className="text-2xl font-black text-ink">Area amministratore</h1>
          <p className="mb-6 mt-1 text-[15px] font-medium text-ink-soft">Accedi per gestire le domande del quiz.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
