import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LoginForm } from "@/components/admin/LoginForm";
import { getSession } from "@/lib/auth/session";

const TEXT = {
  admin: { label: "Amministrazione", title: "Area amministratore", subtitle: "Accedi per gestire domande, premi e statistiche." },
  cassa: { label: "Cassa", title: "Accesso cassa", subtitle: "Riservato al personale autorizzato." },
};

/** Schermata di login condivisa da /admin e /cassa. */
export async function StaffLoginPage({ area }: { area: "admin" | "cassa" }) {
  let session = null;
  try {
    session = await getSession(area);
  } catch {
    session = null;
  }
  if (session) redirect(`/${area}/dashboard`);
  const t = TEXT[area];

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-brand-red to-brand-red-dark px-4 py-10 pt-[calc(var(--safe-top)+2.5rem)] pb-[calc(var(--safe-bottom)+2.5rem)]">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandLogo size="md" />
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-brand-yellow">{t.label}</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          <h1 className="text-2xl font-black text-ink">{t.title}</h1>
          <p className="mb-6 mt-1 text-[15px] font-medium text-ink-soft">{t.subtitle}</p>
          <LoginForm area={area} />
        </div>
      </div>
    </main>
  );
}
