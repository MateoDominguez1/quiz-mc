import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { QuestionForm } from "@/components/admin/QuestionForm";

export default function NewQuestionPage() {
  return (
    <div className="mx-auto max-w-2xl animate-fade-up space-y-5">
      <div>
        <Link href="/admin/domande" className="mb-2 inline-flex h-10 items-center gap-1.5 font-bold text-ink-soft hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Torna alle domande
        </Link>
        <h1 className="text-2xl font-black text-ink sm:text-3xl">Nuova domanda</h1>
        <p className="font-semibold text-ink-soft">Tutti i campi sono obbligatori.</p>
      </div>
      <QuestionForm />
    </div>
  );
}
