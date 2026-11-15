"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Ricarica periodicamente i dati del server (solo quando la pagina è visibile). */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
