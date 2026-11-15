import { CalendarDays, CircleHelp, Gift, PackageCheck, PackageOpen, Trophy, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { ResetStats } from "@/components/admin/ResetStats";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { formatItalianDate } from "@/lib/date";
import { getStats } from "@/lib/services/questions";
import { PRIZE_INFO, PRIZE_TYPES } from "@/types/quiz";

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("it-IT");

export default async function DashboardPage() {
  const s = await getStats();
  const winRate = s.totalParticipants > 0 ? Math.round((s.totalWinners / s.totalParticipants) * 100) : 0;
  const maxBracket = Math.max(1, ...s.ageBrackets.map((b) => b.count));

  const cards = [
    { label: "Totale partecipanti", value: s.totalParticipants, hint: `${nf.format(s.todayParticipants)} oggi`, icon: Users, tone: "bg-sky-50 text-sky-700" },
    {
      label: "Totale vincitori",
      value: s.totalWinners,
      hint: s.totalParticipants > 0 ? `${winRate}% · ${nf.format(s.todayWinners)} oggi` : `${nf.format(s.todayWinners)} oggi`,
      icon: Trophy,
      tone: "bg-amber-50 text-amber-700",
    },
    { label: "Premi riscattati", value: s.prizesRedeemed, icon: PackageCheck, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Premi da ritirare", value: s.prizesPending, icon: PackageOpen, tone: "bg-red-50 text-brand-red" },
  ];

  return (
    <div className="animate-fade-up space-y-6">
      <AutoRefresh seconds={60} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-ink sm:text-3xl">Dashboard</h1>
        <p className="flex items-center gap-2 font-semibold text-ink-soft">
          <CalendarDays className="size-4" aria-hidden /> {formatItalianDate(s.date)} · dati cumulativi, aggiornati automaticamente
        </p>
      </div>

      {s.activeQuestions === 0 && (
        <div className="flex gap-3 rounded-2xl border-2 border-brand-yellow bg-brand-yellow-light p-4">
          <TriangleAlert className="mt-0.5 size-6 shrink-0 text-amber-700" aria-hidden />
          <div>
            <p className="font-black">Nessuna domanda attiva</p>
            <p className="text-[15px] text-ink-soft">I partecipanti non riceveranno alcuna domanda. Crea o attiva almeno una domanda.</p>
          </div>
        </div>
      )}

      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">
          Statistiche generali
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
                <div className={`mb-3 grid size-10 place-items-center rounded-xl ${c.tone}`}>
                  <Icon className="size-5" aria-hidden />
                </div>
                <p className="text-3xl font-black tabular-nums">{nf.format(c.value)}</p>
                <p className="text-sm font-bold text-ink-soft">{c.label}</p>
                {c.hint && <p className="mt-0.5 text-xs text-neutral-500">{c.hint}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6 lg:col-span-3" aria-labelledby="age-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2 id="age-title" className="text-lg font-black">
              Età dei partecipanti
            </h2>
            <p className="text-sm font-bold text-ink-soft">
              Età media:{" "}
              <span className="text-2xl font-black text-ink">
                {s.averageAge === null ? "–" : `${s.averageAge.toLocaleString("it-IT")} anni`}
              </span>
            </p>
          </div>
          {s.totalParticipants === 0 ? (
            <p className="text-ink-soft">Nessun partecipante ancora registrato.</p>
          ) : (
            <ul className="space-y-3">
              {s.ageBrackets.map((b) => (
                <li key={b.label}>
                  <div className="mb-1 flex justify-between gap-3 text-sm font-bold">
                    <span>{b.label} anni</span>
                    <span className="tabular-nums text-ink-soft">
                      {nf.format(b.count)} · {b.percent.toLocaleString("it-IT")}%
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
                    <div className="h-full rounded-full bg-brand-red" style={{ width: `${(b.count / maxBracket) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6 lg:col-span-2" aria-labelledby="prizes-title">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 id="prizes-title" className="text-lg font-black">
              Premi per tipo
            </h2>
            <Link href="/admin/premi" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-neutral-100 px-3 text-sm font-bold hover:bg-neutral-200">
              <Gift className="size-4" aria-hidden /> Modifica premi
            </Link>
          </div>
          <ul className="space-y-3">
            {PRIZE_TYPES.map((t) => {
              const p = s.prizesByType[t];
              return (
                <li key={t} className="rounded-2xl bg-neutral-50 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-black">{p.label}</span>
                    <span className="text-xs font-bold text-neutral-500">{PRIZE_INFO[t].ages}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-ink-soft">
                    {nf.format(p.won)} vinti · {nf.format(p.redeemed)} riscattati · {nf.format(p.won - p.redeemed)} da ritirare
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="flex items-center gap-2 font-bold text-ink-soft">
          <CircleHelp className="size-5" aria-hidden /> {s.activeQuestions} domande attive su {s.totalQuestions}
        </p>
        <Link
          href="/admin/domande"
          className="flex h-12 items-center justify-center rounded-2xl bg-brand-red px-6 font-black text-white shadow-[0_4px_0_0_var(--color-brand-red-darker)] active:translate-y-0.5 active:shadow-none"
        >
          Gestione delle domande
        </Link>
      </section>

      <ResetStats pendingPrizes={s.prizesPending} />
    </div>
  );
}
