import { CalendarDays, CircleHelp, PlusCircle, Sparkles, Trophy, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { formatItalianDate } from "@/lib/date";
import { getStats } from "@/lib/services/questions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getStats();
  const winRate =
    stats.todayParticipants > 0 ? Math.round((stats.todayWinners / stats.todayParticipants) * 100) : 0;

  const cards = [
    { label: "Partecipanti oggi", value: stats.todayParticipants, icon: Users, tone: "bg-sky-50 text-sky-700" },
    {
      label: "Vincitori oggi",
      value: stats.todayWinners,
      hint: stats.todayParticipants > 0 ? `${winRate}% di risposte corrette` : undefined,
      icon: Trophy,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Domande attive",
      value: stats.activeQuestions,
      hint: `su ${stats.totalQuestions} totali`,
      icon: CircleHelp,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Mai utilizzate",
      value: stats.neverUsedActive,
      hint: "domande attive ancora da proporre",
      icon: Sparkles,
      tone: "bg-violet-50 text-violet-700",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-ink sm:text-3xl">Dashboard</h1>
        <p className="flex items-center gap-2 font-semibold text-ink-soft">
          <CalendarDays className="size-4" aria-hidden /> {formatItalianDate(stats.date)}
        </p>
      </div>

      {stats.activeQuestions === 0 && (
        <div className="flex gap-3 rounded-2xl border-2 border-mc-yellow bg-mc-yellow-light p-4">
          <TriangleAlert className="mt-0.5 size-6 shrink-0 text-amber-700" aria-hidden />
          <div>
            <p className="font-black">Nessuna domanda attiva</p>
            <p className="text-[15px] text-ink-soft">
              I partecipanti vedranno il messaggio &quot;Al momento non ci sono domande disponibili&quot;. Crea o
              attiva almeno una domanda.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
              <div className={`mb-3 grid size-10 place-items-center rounded-xl ${c.tone}`}>
                <Icon className="size-5" aria-hidden />
              </div>
              <p className="text-3xl font-black tabular-nums">{c.value}</p>
              <p className="text-sm font-bold text-ink-soft">{c.label}</p>
              {c.hint && <p className="mt-0.5 text-xs text-neutral-500">{c.hint}</p>}
            </div>
          );
        })}
      </div>

      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6" aria-labelledby="today-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="today-title" className="text-lg font-black">
            Domanda di oggi
          </h2>
          <span className="whitespace-nowrap rounded-full bg-mc-red/10 px-3 py-1 text-xs font-extrabold text-mc-red">
            Cambia alle 00:00 (ora italiana)
          </span>
        </div>
        {stats.todayQuestion ? (
          <div className="space-y-3">
            <p className="text-lg font-bold leading-snug">{stats.todayQuestion.questionText}</p>
            <p className="text-[15px] text-ink-soft">
              Risposta corretta:{" "}
              <span className="rounded-lg bg-emerald-100 px-2 py-0.5 font-black text-emerald-800">
                {stats.todayQuestion.correctAnswer}
              </span>
            </p>
            <Link
              href={`/admin/domande/${stats.todayQuestion.id}`}
              className="inline-flex h-11 items-center rounded-xl bg-neutral-100 px-4 font-bold hover:bg-neutral-200"
            >
              Modifica questa domanda
            </Link>
          </div>
        ) : (
          <p className="text-[15px] text-ink-soft">
            Non ancora assegnata: verrà scelta automaticamente alla prima visita di oggi tra le domande attive.
          </p>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/admin/domande/nuova"
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-mc-red px-6 text-lg font-black text-white shadow-[0_4px_0_0_var(--color-mc-red-darker)] active:translate-y-0.5 active:shadow-none"
        >
          <PlusCircle className="size-5" aria-hidden /> Nuova domanda
        </Link>
        <Link
          href="/admin/domande"
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-lg font-black text-ink shadow-sm hover:bg-neutral-50"
        >
          Gestione delle domande
        </Link>
      </div>
    </div>
  );
}
