import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { formatItalianDateTime } from "@/lib/date";
import { listRedemptions } from "@/lib/services/cassa";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { items, redeemedToday, pendingTotal } = await listRedemptions(100);
  return (
    <div className="mx-auto max-w-3xl animate-fade-up space-y-5">
      <AutoRefresh seconds={60} />
      <h1 className="text-2xl font-black text-ink sm:text-3xl">Storico riscossioni</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-3xl font-black tabular-nums">{redeemedToday}</p>
          <p className="text-sm font-bold text-ink-soft">Consegnati oggi</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-3xl font-black tabular-nums">{pendingTotal}</p>
          <p className="text-sm font-bold text-ink-soft">Premi ancora da ritirare</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center font-bold text-ink-soft shadow-sm">Nessun premio riscattato finora.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-3xl bg-white shadow-sm">
          {items.map((r) => (
            <li key={r.code} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="font-mono text-lg font-black">{r.code}</p>
                <p className="text-sm font-semibold text-ink-soft">{formatItalianDateTime(r.redeemedAt)}</p>
              </div>
              <span className="shrink-0 rounded-full bg-brand-yellow-light px-3 py-1 text-sm font-black text-ink">{r.label}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-center text-xs font-semibold text-neutral-500">Ultime 100 riscossioni · aggiornamento automatico</p>
    </div>
  );
}
