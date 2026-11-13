"use client";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  fields?: Record<string, string>;
  code?: string;
}

const NETWORK_ERROR = "Connessione assente o instabile. Controlla la rete e riprova.";

/**
 * fetch con timeout e gestione uniforme degli errori (messaggi in italiano).
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);
  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
      credentials: "same-origin",
    });
    let payload: Record<string, unknown> | null = null;
    try {
      payload = (await res.json()) as Record<string, unknown>;
    } catch {
      payload = null;
    }
    if (!res.ok || !payload || payload.ok === false) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: (payload?.error as string) ?? "Si è verificato un errore. Riprova.",
        fields: payload?.fields as Record<string, string> | undefined,
        code: payload?.code as string | undefined,
      };
    }
    return { ok: true, status: res.status, data: payload as T, error: null };
  } catch {
    return { ok: false, status: 0, data: null, error: NETWORK_ERROR };
  } finally {
    clearTimeout(timer);
  }
}
