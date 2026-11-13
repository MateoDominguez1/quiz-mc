import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuestionForm } from "@/components/admin/QuestionForm";
import { formatItalianDateTime } from "@/lib/date";
import { getQuestion } from "@/lib/services/questions";
import { uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function EditQuestionPage({ params }: PageProps<"/admin/domande/[id]">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const question = await getQuestion(id);
  if (!question) notFound();

  return (
    <div className="mx-auto max-w-2xl animate-fade-up space-y-5">
      <div>
        <Link href="/admin/domande" className="mb-2 inline-flex h-10 items-center gap-1.5 font-bold text-ink-soft hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Torna alle domande
        </Link>
        <h1 className="text-2xl font-black text-ink sm:text-3xl">Modifica domanda</h1>
        <p className="text-sm font-semibold text-ink-soft">
          Creata il {formatItalianDateTime(question.createdAt)} · Ultima modifica {formatItalianDateTime(question.updatedAt)}
        </p>
      </div>
      <QuestionForm initial={question} />
    </div>
  );
}
