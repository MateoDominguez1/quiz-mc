import { CalendarDays, CircleHelp, Gift, House, Package, Sandwich, Store, TriangleAlert, Trophy } from "lucide-react";
import Link from "next/link";
import { ResetStats } from "@/components/admin/ResetStats";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { formatItalianDate } from "@/lib/date";
import { getStats } from "@/lib/services/questions";
import { DIFFICULTIES, DIFFICULTY_INFO, GAME_INFO, type ModeStats } from "@/types/quiz";

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("it-IT");

function rate(m: ModeStats) {
  return m.played > 0 ? Math.round((m.won / m.played) * 100) : 0;
}

const shortName = (name: string) => name.replace(/^McDonald's\s*/i, "");

export default async function DashboardPage({ searchParams }: PageProps<"/admin/dashboard">) {
  const { r } = await searchParams;
  const wanted = typeof r === "string" && /^[a-z0-9-]{2,30}$/.test(r) ? r : null;
  let s = await getStats(wanted);
  if (wanted && !s.restaurants.some((x) => x.key === wanted)) s = await getStats(null);
  const current = s.restaurants.find((x) => x.key === s.restaurant) ?? null;
  const casettePrizes = s.prizes.filter((p) => p.pool === "casette");
  const bigmac = s.prizes.find((p) => p.pool === "bigmac");
  const maxStock = Math.max(1, ...casettePrizes.map((p) => (p.stock ?? 0) + p.won));
  const [easy, medium, hard] = s.activeByDifficulty;

  const cards = [
    {
      label: "Partite giocate",
      value: s.casette.played + s.bigmac.played,
      hint: `${nf.format(s.casette.todayPlayed + s.bigmac.todayPlayed)} oggi`,
      icon: Trophy,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Vincite alle casette",
      value: s.casette.won,
      hint: `${rate(s.casette)}% su ${nf.format(s.casette.played)} · ${nf.format(s.casette.todayWon)} oggi`,
      icon: House,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Big Mac vinti",
      value: s.bigmac.won,
      hint: `${rate(s.bigmac)}% su ${nf.format(s.bigmac.played)} · ${nf.format(s.bigmac.todayWon)} oggi`,
      icon: Sandwich,
      tone: "bg-red-50 text-brand-red",
    },
    {
      label: current ? "Premi casette rimasti" : "Premi casette rimasti (tutti)",
      value: s.stockLeft,
      hint: s.stockLeft === 0 ? "Esauriti: le casette sono bloccate" : undefined,
      icon: Package,
      tone: "bg-emerald-50 text-emerald-700",
    },
  ];

  const warnings: string[] = [];
  if (easy === 0) warnings.push("Nessuna domanda facile attiva: \"Le casette della fortuna\" non può partire.");
  if (easy === 0 || medium === 0 || hard === 0) {
    warnings.push("Per \"La sfida Big Mac\" serve almeno una domanda attiva facile, una media e una difficile.");
  }
  for (const x of s.restaurants) {
    if ((!current || current.key === x.key) && x.stockLeft === 0) {
      warnings.push(`${x.name}: premi delle casette esauriti. Aggiorna le scorte in Premi e scorte.`);
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      <AutoRefresh seconds={60} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-ink sm:text-3xl">Dashboard</h1>
        <p className="flex items-center gap-2 font-semibold text-ink-soft">
          <CalendarDays className="size-4" aria-hidden /> {formatItalianDate(s.date)} · dati cumulativi, aggiornati automaticamente
        </p>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtra per ristorante">
        {[{ key: null as string | null, name: "Tutti i ristoranti" }, ...s.restaurants].map((x) => {
          const active = (x.key ?? null) === (s.restaurant ?? null);
          return (
            <Link
              key={x.key ?? "all"}
              href={x.key ? `/admin/dashboard?r=${x.key}` : "/admin/dashboard"}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-extrabold transition ${
                active ? "bg-brand-red text-white shadow-sm" : "bg-white text-ink-soft shadow-sm hover:bg-neutral-50"
              }`}
            >
              {x.key ? shortName(x.name) : x.name}
            </Link>
          );
        })}
      </nav>

      {!current && (
        <section aria-labelledby="restaurants-title">
          <h2 id="restaurants-title" className="mb-3 flex items-center gap-2 text-lg font-black">
            <Store className="size-5 text-brand-red" aria-hidden /> Ristoranti
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {s.restaurants.map((x) => (
              <li key={x.key}>
                <Link
                  href={`/admin/dashboard?r=${x.key}`}
                  className="block rounded-2xl border-2 border-transparent bg-white p-4 shadow-sm transition hover:border-brand-yellow"
                >
                  <p className="text-xs font-black uppercase tracking-wider text-brand-red">McDonald&apos;s</p>
                  <p className="text-xl font-black">{shortName(x.name)}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs font-bold text-neutral-500">Partite</dt>
                      <dd className="font-black tabular-nums">
                        {nf.format(x.played)} <span className="text-xs font-bold text-neutral-500">({nf.format(x.todayPlayed)} oggi)</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-neutral-500">Premi rimasti</dt>
                      <dd className={`font-black tabular-nums ${x.stockLeft === 0 ? "text-brand-red" : ""}`}>{nf.format(x.stockLeft)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-neutral-500">🏠 Casette vinte</dt>
                      <dd className="font-black tabular-nums">{nf.format(x.casetteWon)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-neutral-500">🍔 Big Mac vinti</dt>
                      <dd className="font-black tabular-nums">{nf.format(x.bigmacWon)}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {current && <h2 className="text-xl font-black">{current.name}</h2>}

      {warnings.length > 0 && (
        <div className="flex gap-3 rounded-2xl border-2 border-brand-yellow bg-brand-yellow-light p-4">
          <TriangleAlert className="mt-0.5 size-6 shrink-0 text-amber-700" aria-hidden />
          <ul className="space-y-1 text-[15px] font-bold text-ink">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
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
        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6 lg:col-span-3" aria-labelledby="prizes-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="prizes-title" className="text-lg font-black">
              {GAME_INFO.casette.emoji} Premi delle casette
            </h2>
            <Link href="/admin/premi" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-neutral-100 px-3 text-sm font-bold hover:bg-neutral-200">
              <Gift className="size-4" aria-hidden /> Premi e scorte
            </Link>
          </div>
          <ul className="space-y-3">
            {casettePrizes.map((p) => {
              const stock = p.stock ?? 0;
              return (
                <li key={p.key}>
                  <div className="mb-1 flex justify-between gap-3 text-sm font-bold">
                    <span>{p.label}</span>
                    <span className={`tabular-nums ${stock === 0 ? "text-brand-red" : "text-ink-soft"}`}>
                      {stock === 0 ? "esaurito" : `${nf.format(stock)} rimasti`} · {nf.format(p.won)} vinti
                      {p.wonToday > 0 ? ` (${nf.format(p.wonToday)} oggi)` : ""}
                    </span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
                    <div className="h-full bg-brand-red" style={{ width: `${(p.won / maxStock) * 100}%` }} />
                    <div className="h-full bg-brand-yellow" style={{ width: `${(stock / maxStock) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-brand-red" /> vinti
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-brand-yellow" /> rimasti
            </span>
          </p>
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6" aria-labelledby="games-title">
            <h2 id="games-title" className="mb-4 text-lg font-black">
              I due giochi
            </h2>
            <ul className="space-y-3">
              {(["casette", "bigmac"] as const).map((m) => {
                const st = s[m];
                return (
                  <li key={m} className="rounded-2xl bg-neutral-50 px-4 py-3">
                    <p className="font-black">
                      {GAME_INFO[m].emoji} {GAME_INFO[m].title}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink-soft">
                      {nf.format(st.played)} giocate · {nf.format(st.won)} vinte · {nf.format(st.lost)} perse
                    </p>
                  </li>
                );
              })}
            </ul>
            {bigmac && (
              <p className="mt-3 text-sm font-semibold text-ink-soft">
                {bigmac.label}: {nf.format(bigmac.won)} vinti in totale.
              </p>
            )}
            {s.abandoned > 0 && (
              <p className="mt-1 text-xs font-semibold text-neutral-500">
                {nf.format(s.abandoned)} partite annullate con &quot;Nuovo cliente&quot; (non conteggiate).
              </p>
            )}
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6" aria-labelledby="questions-title">
            <h2 id="questions-title" className="mb-3 flex items-center gap-2 text-lg font-black">
              <CircleHelp className="size-5" aria-hidden /> Domande attive
            </h2>
            <ul className="grid grid-cols-3 gap-2 text-center">
              {DIFFICULTIES.map((d) => (
                <li key={d} className={`rounded-2xl px-2 py-3 ${DIFFICULTY_INFO[d].badge}`}>
                  <p className="text-2xl font-black tabular-nums">{nf.format(s.activeByDifficulty[d])}</p>
                  <p className="text-xs font-black">{DIFFICULTY_INFO[d].label}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-semibold text-neutral-500">{nf.format(s.totalQuestions)} domande in totale</p>
            <Link
              href="/admin/domande"
              className="mt-4 flex h-12 items-center justify-center rounded-2xl bg-brand-red px-6 font-black text-white shadow-[0_4px_0_0_var(--color-brand-red-darker)] active:translate-y-0.5 active:shadow-none"
            >
              Gestione delle domande
            </Link>
          </section>
        </div>
      </div>

      <ResetStats />
    </div>
  );
}
