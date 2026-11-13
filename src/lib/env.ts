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

export function getSupabaseEnv() {
  return {
    url: required(
      "SUPABASE_URL",
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export function getAdminEnv() {
  const secret = required("ADMIN_SESSION_SECRET", process.env.ADMIN_SESSION_SECRET);
  if (secret.length < 32) {
    throw new ConfigError("ADMIN_SESSION_SECRET deve contenere almeno 32 caratteri");
  }
  return {
    username: required("ADMIN_USERNAME", process.env.ADMIN_USERNAME),
    password: required("ADMIN_PASSWORD", process.env.ADMIN_PASSWORD),
    sessionSecret: secret,
  };
}

/** Sale per l'hash degli IP nelle chiavi di rate limiting (mai IP in chiaro nel DB). */
export function getHashSalt(): string {
  return process.env.ADMIN_SESSION_SECRET ?? "quiz-del-giorno";
}
