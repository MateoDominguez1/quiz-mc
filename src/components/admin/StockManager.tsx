"use client";

import { Minus, Plus, Save, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useToast } from "@/components/admin/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/client/api";
import type { PrizeSetting, Restaurant } from "@/types/quiz";

type Grid = Record<string, Record<string, string>>; // ristorante → premio → valore digitato

function toGrid(prizes: PrizeSetting[], restaurants: Restaurant[]): Grid {
  const g: Grid = {};
  for (const r of restaurants) {
    g[r.key] = {};
    for (const p of prizes) g[r.key][p.key] = String(p.stocks?.[r.key] ?? 0);
  }
  return g;
}

/**
 * Pezzi disponibili per ristorante: ogni ristorante ha le proprie scorte e
 * l'estrazione delle casette usa solo quelle del ristorante del dispositivo.
 */
export function StockManager({ prizes, restaurants }: { prizes: PrizeSetting[]; restaurants: Restaurant[] }) {
  const router = useRouter();
  const toast = useToast();
  const casette = useMemo(() => prizes.filter((p) => p.pool === "casette"), [prizes]);
  const [active, setActive] = useState(restaurants[0]?.key ?? "");
  const [saved, setSaved] = useState<Grid>(() => toGrid(casette, restaurants));
  const [values, setValues] = useState<Grid>(() => toGrid(casette, restaurants));
  const [saving, setSaving] = useState(false);

  const row = values[active] ?? {};
  const changed = casette.filter((p) => row[p.key] !== saved[active]?.[p.key]);
  const total = casette.reduce((a, p) => a + (Number(row[p.key]) || 0), 0);

  function set(prize: string, value: string) {
    setValues((v) => ({ ...v, [active]: { ...v[active], [prize]: value.replace(/\D/g, "").slice(0, 5) } }));
  }

  function bump(prize: string, delta: number) {
    set(prize, String(Math.max(0, Math.min(99999, (Number(row[prize]) || 0) + delta))));
  }

  async function save() {
    if (saving || changed.length === 0) return;
    if (changed.some((p) => row[p.key] === "")) {
      toast.show("error", "Inserisci un numero per ogni premio (0 se esaurito).");
      return;
    }
    setSaving(true);
    for (const p of changed) {
      const res = await apiFetch("/api/admin/stock", {
        method: "PUT",
        body: { restaurant: active, prize: p.key, stock: Number(row[p.key]) },
      });
      if (!res.ok) {
        setSaving(false);
        if (res.status === 401) router.replace("/admin");
        toast.show("error", res.error ?? "Salvataggio non riuscito.");
        return;
      }
      setSaved((s) => ({ ...s, [active]: { ...s[active], [p.key]: row[p.key] } }));
    }
    setSaving(false);
    const name = restaurants.find((r) => r.key === active)?.name ?? "";
    toast.show("success", `Scorte di ${name} aggiornate.`);
    router.refresh();
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6" aria-labelledby="stock-title">
      <h2 id="stock-title" className="flex items-center gap-2 text-xl font-black">
        <Store className="size-5 text-brand-red" aria-hidden /> Scorte per ristorante
      </h2>
      <p className="mt-1 text-sm font-semibold text-ink-soft">
        Ogni ristorante ha i suoi premi. Scendono da soli a ogni vincita; più pezzi = più probabilità di essere estratto.
      </p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Ristorante">
        {restaurants.map((r) => {
          const selected = r.key === active;
          const dirty = casette.some((p) => values[r.key]?.[p.key] !== saved[r.key]?.[p.key]);
          return (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(r.key)}
              className={`h-11 shrink-0 rounded-xl px-4 text-sm font-extrabold transition ${
                selected ? "bg-brand-red text-white shadow-sm" : "bg-neutral-100 text-ink-soft hover:bg-neutral-200"
              }`}
            >
              {r.name.replace(/^McDonald's\s*/i, "")}
              {dirty && <span className="ml-1.5 inline-block size-2 rounded-full bg-brand-yellow align-middle" aria-label="modifiche non salvate" />}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 divide-y divide-neutral-100">
        {casette.map((p) => {
          const v = row[p.key] ?? "";
          const isChanged = v !== saved[active]?.[p.key];
          return (
            <li key={p.key} className="flex items-center justify-between gap-3 py-3">
              <label htmlFor={`stock-${active}-${p.key}`} className="min-w-0 flex-1">
                <span className="block font-black">{p.label}</span>
                <span className={`block text-xs font-bold ${v === "0" ? "text-brand-red" : "text-neutral-500"}`}>
                  {v === "0" ? "Esaurito: non viene estratto" : isChanged ? `Prima: ${saved[active]?.[p.key]}` : "pezzi disponibili"}
                </span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => bump(p.key, -1)}
                  aria-label={`Togli un pezzo: ${p.label}`}
                  className="grid size-10 place-items-center rounded-xl bg-neutral-100 hover:bg-neutral-200"
                >
                  <Minus className="size-4" aria-hidden />
                </button>
                <input
                  id={`stock-${active}-${p.key}`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={v}
                  onChange={(e) => set(p.key, e.target.value)}
                  className={`h-11 w-20 rounded-xl border-2 bg-white text-center text-lg font-black tabular-nums outline-none focus:ring-4 focus:ring-brand-yellow/30 ${
                    isChanged ? "border-brand-yellow-dark" : "border-neutral-200"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => bump(p.key, 1)}
                  aria-label={`Aggiungi un pezzo: ${p.label}`}
                  className="grid size-10 place-items-center rounded-xl bg-neutral-100 hover:bg-neutral-200"
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-bold text-ink-soft">
          Totale: <span className="text-xl font-black tabular-nums text-ink">{total}</span> pezzi
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving || changed.length === 0}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink px-6 font-black text-white disabled:bg-neutral-200 disabled:text-neutral-500"
        >
          {saving ? <Spinner /> : <Save className="size-5" aria-hidden />}
          {saving ? "Salvataggio…" : changed.length ? `Salva ${changed.length} modific${changed.length === 1 ? "a" : "he"}` : "Salvato"}
        </button>
      </div>
    </section>
  );
}
