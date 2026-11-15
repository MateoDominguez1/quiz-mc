import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-cream px-6 text-center">
      <BrandLogo size="sm" />
      <h1 className="text-3xl font-black">Pagina non trovata</h1>
      <p className="text-lg font-bold text-ink-soft">La pagina che cerchi non esiste.</p>
      <Link
        href="/"
        className="flex h-14 items-center rounded-2xl bg-brand-red px-8 text-lg font-black text-white shadow-[0_4px_0_0_var(--color-brand-red-darker)]"
      >
        Vai al quiz
      </Link>
    </main>
  );
}
