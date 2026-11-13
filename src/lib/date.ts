/**
 * Utility per date e fuso orario.
 * La "giornata" del quiz è sempre quella di Europe/Rome, calcolata sul server:
 * l'orologio del dispositivo del partecipante non viene mai usato.
 */

export const QUIZ_TIME_ZONE = "Europe/Rome";

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: QUIZ_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data italiana corrente in formato YYYY-MM-DD (gestisce ora legale/solare). */
export function getRomeDateString(now: Date = new Date()): string {
  const parts = isoFormatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Secondi mancanti alla prossima mezzanotte italiana. */
export function secondsUntilRomeMidnight(now: Date = new Date()): number {
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: QUIZ_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const n = (type: string) => Number(timeParts.find((p) => p.type === type)?.value ?? 0);
  const elapsed = n("hour") * 3600 + n("minute") * 60 + n("second");
  return Math.max(86400 - elapsed, 1);
}

/** "Venerdì 13 novembre 2026" a partire da YYYY-MM-DD. */
export function formatItalianDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  // Mezzogiorno UTC: evita slittamenti di giorno dovuti al fuso.
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const text = new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "13/11/2026, 09:30" nel fuso italiano a partire da un timestamp ISO. */
export function formatItalianDateTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: QUIZ_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoTimestamp));
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
