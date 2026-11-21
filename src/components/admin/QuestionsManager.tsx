"use client";

import { CalendarClock, Pencil, PlusCircle, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/client/api";
import { formatItalianDate, formatItalianDateTime } from "@/lib/date";
import { ANSWER_LETTERS, DIFFICULTIES, DIFFICULTY_INFO, type AdminQuestion, type Difficulty } from "@/types/quiz";

type Filter = "all" | "active" | "inactive";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tutte" },
  { value: "active", label: "Attive" },
  { value: "inactive", label: "Disattivate" },
];

function DifficultyBadge({ d }: { d: Difficulty }) {
  const info = DIFFICULTY_INFO[d];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-black ${info.badge}`}>
      {info.emoji} {info.label}
    </span>
  );
}

function answerOf(q: AdminQuestion, l: string) {
  return q[`answer${l}` as "answerA"];
}

function StatusToggle({
  question,
  busy,
  onToggle,
}: {
  question: AdminQuestion;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={question.isActive}
      aria-label={question.isActive ? "Disattiva domanda" : "Attiva domanda"}
      onClick={onToggle}
      disabled={busy}
      className="group inline-flex min-h-11 items-center gap-2 rounded-xl px-1 disabled:opacity-60"
    >
      <span className={`relative h-7 w-12 rounded-full transition ${question.isActive ? "bg-emerald-500" : "bg-neutral-300"}`}>
        <span
          className={`absolute left-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-white shadow transition ${
            question.isActive ? "translate-x-5" : ""
          }`}
        >
          {busy && <Spinner className="size-3.5 text-neutral-500" />}
        </span>
      </span>
      <span className={`text-sm font-extrabold ${question.isActive ? "text-emerald-700" : "text-neutral-500"}`}>
        {question.isActive ? "Attiva" : "Disattivata"}
      </span>
    </button>
  );
}

export function QuestionsManager({ questions, today }: { questions: AdminQuestion[]; today: string }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(questions);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [level, setLevel] = useState<Difficulty | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminQuestion | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Riallinea lo stato locale quando il server invia dati aggiornati.
  const [prevQuestions, setPrevQuestions] = useState(questions);
  if (questions !== prevQuestions) {
    setPrevQuestions(questions);
    setItems(questions);
  }

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("it-IT");
    return items.filter((item) => {
      if (filter === "active" && !item.isActive) return false;
      if (filter === "inactive" && item.isActive) return false;
      if (level !== "all" && item.difficulty !== level) return false;
      if (!q) return true;
      return [item.questionText, item.answerA, item.answerB, item.answerC, item.answerD].some((t) =>
        t.toLocaleLowerCase("it-IT").includes(q),
      );
    });
  }, [items, query, filter, level]);

  async function toggle(q: AdminQuestion) {
    if (busyId) return;
    setBusyId(q.id);
    const res = await apiFetch<{ question: AdminQuestion }>(`/api/admin/questions/${q.id}/status`, {
      method: "PATCH",
      body: { isActive: !q.isActive },
    });
    setBusyId(null);
    if (res.ok && res.data) {
      setItems((list) => list.map((i) => (i.id === q.id ? { ...i, isActive: res.data!.question.isActive } : i)));
      toast.show("success", res.data.question.isActive ? "Domanda attivata." : "Domanda disattivata.");
      router.refresh();
    } else {
      if (res.status === 401) router.replace("/admin");
      toast.show("error", res.error ?? "Operazione non riuscita.");
    }
  }

  async function confirmDelete() {
    if (!toDelete || deleting) return;
    setDeleting(true);
    const res = await apiFetch(`/api/admin/questions/${toDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setItems((list) => list.filter((i) => i.id !== toDelete.id));
      toast.show("success", "Domanda eliminata.");
      setToDelete(null);
      router.refresh();
    } else {
      if (res.status === 401) router.replace("/admin");
      toast.show("error", res.error ?? "Impossibile eliminare la domanda.");
    }
  }

  const counts = {
    all: items.length,
    active: items.filter((i) => i.isActive).length,
    inactive: items.filter((i) => !i.isActive).length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-ink sm:text-3xl">Gestione delle domande</h1>
          <p className="font-semibold text-ink-soft">
            {counts.all} {counts.all === 1 ? "domanda inserita" : "domande inserite"} · {counts.active} attive
          </p>
        </div>
        <Link
          href="/admin/domande/nuova"
          className="hidden h-12 items-center justify-center gap-2 rounded-2xl bg-brand-red px-5 font-black text-white shadow-[0_4px_0_0_var(--color-brand-red-darker)] active:translate-y-0.5 active:shadow-none sm:flex"
        >
          <PlusCircle className="size-5" aria-hidden /> Nuova domanda
        </Link>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca nelle domande…"
            aria-label="Cerca nelle domande"
            className="h-12 w-full rounded-2xl border-2 border-neutral-200 bg-white pl-12 pr-4 font-semibold outline-none focus:border-brand-yellow-dark focus:ring-4 focus:ring-brand-yellow/30"
          />
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 shadow-sm" role="tablist" aria-label="Filtra per stato">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`h-10 whitespace-nowrap rounded-xl px-2 text-sm font-extrabold transition ${
                filter === f.value ? "bg-ink text-white" : "text-ink-soft hover:bg-neutral-100"
              }`}
            >
              {f.label} <span className="hidden tabular-nums opacity-70 sm:inline">({counts[f.value]})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtra per difficoltà">
        {(["all", ...DIFFICULTIES] as const).map((d) => {
          const active = level === d;
          const n = d === "all" ? items.length : items.filter((i) => i.difficulty === d).length;
          return (
            <button
              key={String(d)}
              type="button"
              aria-pressed={active}
              onClick={() => setLevel(d)}
              className={`h-10 rounded-xl px-3 text-sm font-extrabold transition ${
                active ? "bg-ink text-white" : "bg-white text-ink-soft shadow-sm hover:bg-neutral-100"
              }`}
            >
              {d === "all" ? "Tutte le difficoltà" : `${DIFFICULTY_INFO[d].emoji} ${DIFFICULTY_INFO[d].label}`}{" "}
              <span className="tabular-nums opacity-70">({n})</span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-black">Nessuna domanda inserita</p>
          <p className="mt-1 text-ink-soft">Crea la prima domanda per avviare il quiz.</p>
          <Link
            href="/admin/domande/nuova"
            className="mx-auto mt-5 inline-flex h-12 items-center gap-2 rounded-2xl bg-brand-red px-5 font-black text-white"
          >
            <PlusCircle className="size-5" aria-hidden /> Crea una domanda
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center font-bold text-ink-soft shadow-sm">
          Nessuna domanda corrisponde alla ricerca.
        </p>
      ) : (
        <>
          {/* Card: smartphone e tablet verticale */}
          <ul className="space-y-3 lg:hidden">
            {visible.map((q) => (
              <li key={q.id} className="rounded-3xl bg-white p-4 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <DifficultyBadge d={q.difficulty} />
                  {q.lastUsedDate === today && (
                    <span className="rounded-full bg-brand-yellow px-2.5 py-0.5 text-xs font-black text-ink">Usata oggi</span>
                  )}
                  <span className="text-xs font-bold text-neutral-500">Creata il {formatItalianDateTime(q.createdAt)}</span>
                </div>
                <p className="text-[17px] font-extrabold leading-snug">{q.questionText}</p>
                <ul className="mt-3 space-y-1.5">
                  {ANSWER_LETTERS.map((l) => (
                    <li
                      key={l}
                      className={`flex gap-2 rounded-xl px-3 py-2 text-[15px] ${
                        q.correctAnswer === l ? "bg-emerald-50 font-bold text-emerald-900" : "bg-neutral-50"
                      }`}
                    >
                      <span className="font-black">{l}.</span>
                      <span className="min-w-0 flex-1 break-words">{answerOf(q, l)}</span>
                      {q.correctAnswer === l && <span className="text-xs font-black uppercase text-emerald-700">Corretta</span>}
                    </li>
                  ))}
                </ul>
                {q.lastUsedDate && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-neutral-500">
                    <CalendarClock className="size-4" aria-hidden /> Ultimo utilizzo: {formatItalianDate(q.lastUsedDate)} ·{" "}
                    {q.timesUsed} {q.timesUsed === 1 ? "volta" : "volte"}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                  <StatusToggle question={q} busy={busyId === q.id} onToggle={() => toggle(q)} />
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/domande/${q.id}`}
                      className="flex h-11 items-center gap-1.5 rounded-xl bg-neutral-100 px-3 font-bold hover:bg-neutral-200"
                    >
                      <Pencil className="size-4" aria-hidden /> Modifica
                    </Link>
                    <button
                      type="button"
                      onClick={() => setToDelete(q)}
                      className="grid size-11 place-items-center rounded-xl bg-red-50 text-brand-red hover:bg-red-100"
                      aria-label="Elimina domanda"
                    >
                      <Trash2 className="size-5" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Tabella: desktop */}
          <div className="hidden overflow-hidden rounded-3xl bg-white shadow-sm lg:block">
            <table className="w-full text-left">
              <thead className="bg-neutral-50 text-xs font-black uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-5 py-3">Domanda</th>
                  <th className="px-3 py-3">Difficoltà</th>
                  <th className="px-3 py-3">Corretta</th>
                  <th className="px-3 py-3">Stato</th>
                  <th className="px-3 py-3">Creata il</th>
                  <th className="px-5 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visible.map((q) => (
                  <tr key={q.id} className="align-top hover:bg-neutral-50/60">
                    <td className="max-w-md px-5 py-4">
                      <div className="flex items-start gap-2">
                        {q.lastUsedDate === today && (
                          <span className="mt-0.5 rounded-full bg-brand-yellow px-2 py-0.5 text-xs font-black">Usata oggi</span>
                        )}
                        <p className="font-extrabold leading-snug">{q.questionText}</p>
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-ink-soft">
                        {ANSWER_LETTERS.map((l) => `${l}. ${answerOf(q, l)}`).join("  ·  ")}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <DifficultyBadge d={q.difficulty} />
                    </td>
                    <td className="px-3 py-4">
                      <span className="inline-grid size-9 place-items-center rounded-lg bg-emerald-100 font-black text-emerald-800">
                        {q.correctAnswer}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <StatusToggle question={q} busy={busyId === q.id} onToggle={() => toggle(q)} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-ink-soft">
                      {formatItalianDateTime(q.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/domande/${q.id}`}
                          className="flex h-10 items-center gap-1.5 rounded-xl bg-neutral-100 px-3 text-sm font-bold hover:bg-neutral-200"
                        >
                          <Pencil className="size-4" aria-hidden /> Modifica
                        </Link>
                        <button
                          type="button"
                          onClick={() => setToDelete(q)}
                          className="flex h-10 items-center gap-1.5 rounded-xl bg-red-50 px-3 text-sm font-bold text-brand-red hover:bg-red-100"
                        >
                          <Trash2 className="size-4" aria-hidden /> Elimina
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminare la domanda?"
        description={
          toDelete?.lastUsedDate === today
            ? "Questa domanda è stata usata oggi: se è in corso una partita con questa domanda, verrà annullata. Se vuoi solo smettere di proporla, disattivala. L'operazione non può essere annullata."
            : "La domanda verrà eliminata definitivamente (le partite già giocate restano nelle statistiche). L'operazione non può essere annullata."
        }
        confirmLabel="Elimina"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
