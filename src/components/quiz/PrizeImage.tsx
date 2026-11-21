/* eslint-disable @next/next/no-img-element */
import { Car, Drumstick, Gem, Gift, Hamburger, IceCreamCone, Popcorn, Sandwich, type LucideIcon } from "lucide-react";
import type { PrizeKey } from "@/types/quiz";

const FALLBACK_ICON: Record<PrizeKey, LucideIcon> = {
  braccialetto: Gem,
  hamburger: Sandwich,
  nuggets: Drumstick,
  patatine: Popcorn,
  cono: IceCreamCone,
  profumatore: Car,
  gadget: Gift,
  bigmac: Hamburger,
};

/**
 * Foto del premio (caricata dall'amministratore su Supabase Storage).
 * Finché la foto non è caricata viene mostrata un'icona al suo posto.
 */
export function PrizeImage({
  prizeKey,
  label,
  imageUrl,
  className = "size-48",
}: {
  prizeKey: PrizeKey;
  label: string;
  imageUrl: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`Foto del premio: ${label}`}
        className={`${className} rounded-3xl bg-white object-cover shadow-lg`}
        decoding="async"
        fetchPriority="high"
      />
    );
  }
  const Icon = FALLBACK_ICON[prizeKey] ?? Gift;
  return (
    <div role="img" aria-label={`Premio: ${label}`} className={`${className} grid place-items-center rounded-3xl bg-white shadow-lg`}>
      <Icon className="size-1/2 text-brand-red" strokeWidth={1.6} aria-hidden />
    </div>
  );
}
