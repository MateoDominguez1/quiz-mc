import { Ban, WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EntryForm } from "@/components/quiz/EntryForm";
import { MessageCard, QuizLayout } from "@/components/quiz/QuizApp";
import { INVALID_ENTRY_MESSAGE } from "@/lib/messages";
import { getParticipantId, hashEntryToken, isWellFormedEntryToken } from "@/lib/participant";
import { getEntryStatus, type EntryStatus } from "@/lib/services/quiz";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Il Quiz – Inizia",
  // Il link contiene un token: non deve finire nei log di altri siti.
  referrer: "no-referrer",
};

/**
 * Pagina aperta dal QR code della cassa. La sola apertura NON consuma il QR
 * (le anteprime dei link non lo bruciano): viene consumato solo all'invio
 * dell'età, in modo atomico nel database.
 */
export default async function EntryPage({ params }: PageProps<"/q/[token]">) {
  const { token } = await params;

  let status: EntryStatus | "error" = "invalid";
  if (isWellFormedEntryToken(token)) {
    try {
      status = await getEntryStatus(hashEntryToken(token), await getParticipantId());
    } catch (err) {
      console.error("[entry] Verifica QR non riuscita:", err);
      status = "error";
    }
  }

  // Chi ha già usato questo QR (es. ricarica o riapre il link) continua la sua partita.
  if (status === "mine") redirect("/");

  return (
    <QuizLayout>
      {status === "valid" && <EntryForm token={token} />}
      {status === "invalid" && (
        <MessageCard icon={<Ban className="size-10 text-brand-red" aria-hidden />} title={INVALID_ENTRY_MESSAGE} text="Chiedi alla cassa un nuovo QR code." />
      )}
      {status === "error" && (
        <MessageCard
          icon={<WifiOff className="size-10 text-brand-red" aria-hidden />}
          title="Ops! Qualcosa non ha funzionato"
          text="Controlla la connessione e scansiona di nuovo il QR code."
        />
      )}
    </QuizLayout>
  );
}
