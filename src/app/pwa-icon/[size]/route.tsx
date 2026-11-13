import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/icon-art";

const SIZES: Record<string, { size: number; maskable: boolean }> = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  "maskable-512": { size: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export const dynamicParams = false;

/** Icone PNG per il manifest PWA (Android "Aggiungi a schermata Home"). */
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const cfg = SIZES[size];
  if (!cfg) return new Response("Not found", { status: 404 });
  return new ImageResponse(<IconArt size={cfg.size} maskable={cfg.maskable} />, {
    width: cfg.size,
    height: cfg.size,
  });
}
