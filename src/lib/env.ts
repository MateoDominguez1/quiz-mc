import "server-only";

/**
 * Lettura e validazione delle variabili d'ambiente lato server.
 * Nessuna di queste variabili viene esposta al browser.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new ConfigError(`Variabile d'ambiente mancante: ${name}`);
  }
  return value.trim();
}

/**
 * Accetta l'URL del progetto in qualsiasi forma copiata dal pannello Supabase
 * (es. con "/rest/v1/" finale o spazi) e restituisce solo l'origine
 * "https://xxxx.supabase.co": il client aggiunge da solo "/rest/v1".
 */
export function normalizeSupabaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new ConfigError("SUPABASE_URL non è un URL valido (es. https://xxxx.supabase.co)");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ConfigError("SUPABASE_URL deve iniziare con https://");
  }
  return parsed.origin;
}

export function getSupabaseEnv() {
  return {
    url: normalizeSupabaseUrl(
      required("SUPABASE_URL", process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL),
    ),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

/** Segreto unico per firmare tutte le sessioni (admin, cassa, partecipante). */
export function getSessionSecret(): string {
  const secret = required("ADMIN_SESSION_SECRET", process.env.ADMIN_SESSION_SECRET);
  if (secret.length < 32) {
    throw new ConfigError("ADMIN_SESSION_SECRET deve contenere almeno 32 caratteri");
  }
  return secret;
}

export type StaffRole = "admin" | "cassa";

/** Credenziali del personale: ADMIN_USERNAME/ADMIN_PASSWORD e CASSA_USERNAME/CASSA_PASSWORD. */
export function getStaffCredentials(role: StaffRole) {
  const prefix = role === "admin" ? "ADMIN" : "CASSA";
  return {
    username: required(`${prefix}_USERNAME`, process.env[`${prefix}_USERNAME`]),
    password: required(`${prefix}_PASSWORD`, process.env[`${prefix}_PASSWORD`]),
  };
}

/** Durata di validità di un QR non ancora utilizzato (minuti). */
export function getEntryTtlMinutes(): number {
  const n = Number(process.env.QR_VALIDITY_MINUTES);
  return Number.isInteger(n) && n >= 1 && n <= 24 * 60 ? n : 60;
}

/** Sale per l'hash degli IP nelle chiavi di rate limiting (mai IP in chiaro nel DB). */
export function getHashSalt(): string {
  return process.env.ADMIN_SESSION_SECRET ?? "il-quiz";
}
