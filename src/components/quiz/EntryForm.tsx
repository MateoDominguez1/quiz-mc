"use client";

import { CircleAlert, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/client/api";
import { MAX_AGE, ageSchema } from "@/lib/validation";

/**
 * "Quanti anni hai?" – primo passo dopo la scansione del QR.
 * L'invio consuma il QR (nel DB, in modo atomico) e crea la sessione.
 */
export function EntryForm({ token }: { token: string }) {
  const router = useRouter();
  const [age, setAge] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [invalidEntry, setInvalidEntry] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  function onChange(value: string) {
    // Solo cifre: niente segni, virgole o lettere.
    setAge(value.replace(/\D/g, "").slice(0, 3));
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    const parsed = ageSchema.safeParse(age);
    if (!age || !parsed.success) {
      setError(`Inserisci la tua età con un numero intero (da 0 a ${MAX_AGE}).`);
      return;
    }
    inFlight.current = true;
    setLoading(true);
    const res = await apiFetch("/api/entry", { method: "POST", body: { token, age: parsed.data } });
    if (res.ok) {
      // Si esce dall'URL con il token: ricaricando si resta nella propria sessione.
      router.replace("/");
      router.refresh();
      return;
    }
    if (res.code === "invalid_entry") {
      setInvalidEntry(res.error);
    } else {
      setError(res.error);
    }
    setLoading(false);
    inFlight.current = false;
  }

  if (invalidEntry) {
    return (
      <p role="alert" className="flex items-start gap-3 rounded-3xl bg-white p-6 text-xl font-black text-brand-red-dark shadow-lg">
        <CircleAlert className="mt-1 size-6 shrink-0" aria-hidden />
        {invalidEntry}
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="relative z-10 flex animate-fade-up flex-col gap-5 rounded-3xl border-4 border-brand-yellow bg-white px-5 py-7 text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]"
    >
      <label htmlFor="age" className="text-[26px] font-black leading-tight text-ink">
        Quanti anni hai?
      </label>
      <input
        id="age"
        name="age"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="go"
        maxLength={3}
        value={age}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Es. 25"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "age-error" : "age-hint"}
        className={`mx-auto h-20 w-40 rounded-2xl border-[3px] bg-white text-center text-[40px] font-black text-ink outline-none transition placeholder:text-neutral-300 focus:ring-4 ${
          error ? "border-brand-red focus:ring-brand-red/20" : "border-neutral-200 focus:border-brand-yellow-dark focus:ring-brand-yellow/30"
        }`}
      />
      {error ? (
        <p id="age-error" role="alert" className="font-bold text-brand-red">
          {error}
        </p>
      ) : (
        <p id="age-hint" className="font-semibold text-ink-soft">
          Il premio dipende dalla tua età.
        </p>
      )}
      <button
        type="submit"
        disabled={loading || age.length === 0}
        className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-brand-red text-xl font-black text-white shadow-[0_5px_0_0_var(--color-brand-red-darker)] transition active:translate-y-1 active:shadow-none disabled:bg-neutral-300 disabled:text-neutral-500 disabled:shadow-[0_5px_0_0_#bdbdbd]"
      >
        {loading ? <Spinner className="size-6" /> : <Play className="size-6 fill-current" aria-hidden />}
        {loading ? "Un attimo…" : "Inizia il quiz"}
      </button>
    </form>
  );
}
