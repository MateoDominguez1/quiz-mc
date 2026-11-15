import { History, QrCode, TicketCheck } from "lucide-react";
import Link from "next/link";

const CARDS = [
  {
    href: "/cassa/nuova",
    title: "Nuova partecipazione",
    text: "Il cliente ha pagato: genera il QR code monouso.",
    icon: QrCode,
    tone: "bg-brand-red text-white",
    iconTone: "bg-white/15 text-white",
  },
  {
    href: "/cassa/riscatta",
    title: "Riscatta un premio",
    text: "Verifica il codice del cliente e consegna il premio.",
    icon: TicketCheck,
    tone: "bg-brand-yellow text-ink",
    iconTone: "bg-white/50 text-ink",
  },
  {
    href: "/cassa/storico",
    title: "Storico riscossioni",
    text: "Premi già consegnati con data e ora.",
    icon: History,
    tone: "bg-white text-ink",
    iconTone: "bg-neutral-100 text-ink",
  },
];

export default function CassaHomePage() {
  return (
    <div className="mx-auto max-w-3xl animate-fade-up space-y-5">
      <h1 className="text-2xl font-black text-ink sm:text-3xl">Cassa</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {CARDS.map((c, i) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className={`flex min-h-36 items-center gap-5 rounded-3xl p-6 shadow-sm transition active:scale-[0.99] ${c.tone} ${
                i === 2 ? "md:col-span-2" : ""
              }`}
            >
              <span className={`grid size-16 shrink-0 place-items-center rounded-2xl ${c.iconTone}`}>
                <Icon className="size-9" aria-hidden />
              </span>
              <span>
                <span className="block text-2xl font-black leading-tight">{c.title}</span>
                <span className="mt-1 block text-[15px] font-semibold opacity-85">{c.text}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
