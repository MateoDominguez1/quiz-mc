"use client";

import { Eye, EyeOff, LockKeyhole, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/client/api";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    if (!username.trim() || !password) {
      setError("Inserisci nome utente e password.");
      return;
    }
    inFlight.current = true;
    setLoading(true);
    setError(null);
    const res = await apiFetch("/api/admin/login", {
      method: "POST",
      body: { username: username.trim(), password },
    });
    if (res.ok) {
      router.replace("/admin/dashboard");
      router.refresh();
      return; // resta in caricamento fino al cambio pagina
    }
    setError(res.error);
    setPassword("");
    setLoading(false);
    inFlight.current = false;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="username" className="block text-sm font-extrabold text-ink">
          Nome utente
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-14 w-full rounded-2xl border-2 border-neutral-200 bg-white pl-12 pr-4 font-bold text-ink outline-none transition focus:border-mc-yellow-dark focus:ring-4 focus:ring-mc-yellow/30"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-extrabold text-ink">
          Password
        </label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 w-full rounded-2xl border-2 border-neutral-200 bg-white pl-12 pr-14 font-bold text-ink outline-none transition focus:border-mc-yellow-dark focus:ring-4 focus:ring-mc-yellow/30"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-xl text-ink-soft hover:bg-neutral-100"
            aria-label={showPassword ? "Nascondi password" : "Mostra password"}
          >
            {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-[15px] font-bold text-mc-red-dark">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-mc-red text-lg font-black text-white shadow-[0_4px_0_0_var(--color-mc-red-darker)] transition active:translate-y-0.5 active:shadow-none disabled:opacity-70"
      >
        {loading ? (
          <>
            <Spinner /> Accesso in corso…
          </>
        ) : (
          "Accedi"
        )}
      </button>
    </form>
  );
}
