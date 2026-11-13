import { describe, expect, it } from "vitest";
import { formatItalianDate, getRomeDateString, isValidIsoDate, secondsUntilRomeMidnight } from "@/lib/date";

describe("getRomeDateString", () => {
  it("cambia giorno alla mezzanotte italiana (ora solare, UTC+1)", () => {
    expect(getRomeDateString(new Date("2026-11-13T22:59:59Z"))).toBe("2026-11-13");
    expect(getRomeDateString(new Date("2026-11-13T23:00:00Z"))).toBe("2026-11-14");
  });

  it("cambia giorno alla mezzanotte italiana (ora legale, UTC+2)", () => {
    expect(getRomeDateString(new Date("2026-07-01T21:59:59Z"))).toBe("2026-07-01");
    expect(getRomeDateString(new Date("2026-07-01T22:00:00Z"))).toBe("2026-07-02");
  });

  it("gestisce il cambio d'anno", () => {
    expect(getRomeDateString(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});

describe("secondsUntilRomeMidnight", () => {
  it("calcola i secondi alla prossima mezzanotte italiana", () => {
    // 22:00 ora italiana (21:00 UTC in inverno) → 2 ore
    expect(secondsUntilRomeMidnight(new Date("2026-11-13T21:00:00Z"))).toBe(7200);
  });
});

describe("formatItalianDate", () => {
  it("formatta in italiano con iniziale maiuscola", () => {
    expect(formatItalianDate("2026-11-13")).toBe("Venerdì 13 novembre 2026");
  });
});

describe("isValidIsoDate", () => {
  it("valida le date", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("13/11/2026")).toBe(false);
  });
});
