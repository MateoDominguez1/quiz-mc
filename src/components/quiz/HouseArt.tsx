import type { ReactNode } from "react";
import type { HouseKey } from "@/types/quiz";

/** Illustrazioni delle Case Ronald, ispirate alle città italiane. */
const ART: Record<HouseKey, { roof: string; wall: string; scenery: ReactNode }> = {
  brescia: {
    roof: "#b75b45",
    wall: "#f5d1a8",
    scenery: (
      <>
        <path d="M0 75L28 23 52 64 80 32 120 76" fill="#9bb6ae" />
        <path d="M18 42L28 23 39 43" fill="white" />
      </>
    ),
  },
  firenze: {
    roof: "#ad4935",
    wall: "#f3c59e",
    scenery: (
      <>
        <path d="M3 78V42Q24 5 45 42V78" fill="#c78361" />
        <path d="M24 15V6" stroke="#92553d" strokeWidth="4" />
      </>
    ),
  },
  bologna: {
    roof: "#a94133",
    wall: "#edb784",
    scenery: (
      <>
        <path d="M6 75V21H19V75M24 75V35H35V75" fill="#b78b71" />
        <path d="M0 95Q12 65 24 95Q36 65 48 95" fill="none" stroke="#b78b71" strokeWidth="5" />
      </>
    ),
  },
  "roma-palidoro": {
    roof: "#be8754",
    wall: "#fff0c4",
    scenery: (
      <>
        <path d="M0 89Q20 78 40 89T80 89T120 89V110H0" fill="#9bd5dd" />
        <path d="M15 80V36" stroke="#82563c" strokeWidth="5" />
        <ellipse cx="15" cy="33" rx="20" ry="12" fill="#64926a" />
      </>
    ),
  },
  "milano-niguarda": {
    roof: "#798caa",
    wall: "#e2e8ef",
    scenery: <path d="M3 79V40L10 21 17 40V79M20 79V30L28 8 36 30V79M39 79V40L46 21 53 40V79" fill="#b4b8c9" />,
  },
};

export function HouseArt({ house, className = "" }: { house: HouseKey; className?: string }) {
  const a = ART[house];
  return (
    <svg viewBox="0 0 120 110" aria-hidden className={className}>
      <rect width="120" height="110" rx="12" fill="#e7f3f6" />
      {a.scenery}
      <rect x="34" y="49" width="70" height="51" rx="3" fill={a.wall} />
      <path d="M26 52L69 17 112 52Z" fill={a.roof} />
      <rect x="43" y="60" width="18" height="20" rx="3" fill="#ffca42" stroke="#fff" strokeWidth="2" />
      <rect x="78" y="60" width="18" height="20" rx="3" fill="#ffca42" stroke="#fff" strokeWidth="2" />
      <rect x="62" y="75" width="15" height="25" rx="5" fill={a.roof} />
      <path d="M69 41C59 34 60 27 65 28Q69 28 69 32Q76 23 80 30Q84 35 69 41" fill="#fff" />
      <text x="69.5" y="92" textAnchor="middle" fill="white" fontSize="14" fontWeight="900">
        ?
      </text>
    </svg>
  );
}
