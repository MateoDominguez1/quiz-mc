/* eslint-disable @next/next/no-img-element */

/**
 * Logo dell'app "Il Quiz": identità propria (punto interrogativo giallo su
 * rosso), nessun riferimento a marchi di terzi. Per usare un logo diverso:
 * copiarlo in /public e impostare NEXT_PUBLIC_LOGO_URL (es. /logo.svg).
 */
const LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL?.trim() || "";

export const APP_NAME = "Il Quiz";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  /** "light" su sfondo rosso/nero, "dark" su sfondo bianco. */
  tone?: "light" | "dark";
  className?: string;
}

const sizes = {
  sm: { box: "size-8 text-lg", text: "text-lg", img: "h-8" },
  md: { box: "size-11 text-2xl", text: "text-2xl", img: "h-12" },
  lg: { box: "size-14 text-3xl", text: "text-3xl", img: "h-16" },
};

export function BrandLogo({ size = "md", tone = "light", className = "" }: BrandLogoProps) {
  const s = sizes[size];
  if (LOGO_URL) {
    return <img src={LOGO_URL} alt={APP_NAME} className={`${s.img} w-auto object-contain ${className}`} decoding="async" />;
  }
  return (
    <span role="img" aria-label={APP_NAME} className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className={`grid ${s.box} place-items-center rounded-full bg-brand-yellow font-black leading-none text-brand-red shadow-[0_3px_0_0_var(--color-brand-yellow-dark)]`}
      >
        ?
      </span>
      <span aria-hidden className={`${s.text} font-black tracking-tight ${tone === "light" ? "text-white" : "text-ink"}`}>
        Il <span className={tone === "light" ? "text-brand-yellow" : "text-brand-red"}>Quiz</span>
      </span>
    </span>
  );
}
