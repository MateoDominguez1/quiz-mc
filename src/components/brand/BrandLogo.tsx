/* eslint-disable @next/next/no-img-element */

/**
 * Spazio riservato al logo ufficiale.
 * Per usare il logo fornito: copiarlo in /public (es. /public/logo.svg)
 * e impostare NEXT_PUBLIC_LOGO_URL=/logo.svg. Senza logo viene mostrato
 * il nome del ristorante in forma testuale (nessun logo non autorizzato).
 */
const LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL?.trim() || "";
const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "McDonald's";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const heights = { sm: "h-8", md: "h-12", lg: "h-16" };
const textSizes = { sm: "text-base px-3 py-1", md: "text-xl px-4 py-1.5", lg: "text-2xl px-5 py-2" };

export function BrandLogo({ size = "md", className = "" }: BrandLogoProps) {
  if (LOGO_URL) {
    return (
      <img
        src={LOGO_URL}
        alt={BRAND_NAME}
        className={`${heights[size]} w-auto object-contain ${className}`}
        decoding="async"
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={BRAND_NAME}
      className={`inline-flex items-center rounded-full bg-mc-yellow font-black tracking-tight text-mc-red shadow-[0_3px_0_0_var(--color-mc-yellow-dark)] ${textSizes[size]} ${className}`}
    >
      {BRAND_NAME}
    </span>
  );
}

export const brandName = BRAND_NAME;
