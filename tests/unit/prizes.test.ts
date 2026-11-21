import { describe, expect, it } from "vitest";
import { detectImageType } from "@/lib/services/prizes";

describe("riconoscimento formato immagini", () => {
  const pad = (b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
  it("riconosce JPEG, PNG e WebP dai byte reali", () => {
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))?.type).toBe("image/jpeg");
    expect(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))?.type).toBe("image/png");
    expect(detectImageType(pad([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))?.type).toBe("image/webp");
  });
  it("rifiuta altri file", () => {
    expect(detectImageType(pad([0x3c, 0x73, 0x76, 0x67]))).toBeNull(); // <svg
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("messaggio di vittoria", () => {
  it("usa il messaggio personalizzato, poi quello predefinito, poi uno generico", async () => {
    const { winMessageFor } = await import("@/types/quiz");
    expect(winMessageFor("cono", "Gelato", "Bravo! Un gelato per te!")).toBe("Bravo! Un gelato per te!");
    expect(winMessageFor("cono", "Cono", null)).toBe("Hai vinto un cono!");
    expect(winMessageFor("bigmac", "big mac", null)).toBe("Hai vinto un Big Mac!");
    expect(winMessageFor("gadget", "Portachiavi", "  ")).toBe("Hai vinto: Portachiavi!");
  });
});
