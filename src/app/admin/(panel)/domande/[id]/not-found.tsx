import Link from "next/link";

export default function QuestionNotFound() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-3xl bg-white p-6 text-center shadow-sm">
      <h2 className="text-xl font-black">Domanda non trovata</h2>
      <p className="mt-2 text-ink-soft">La domanda potrebbe essere stata eliminata.</p>
      <Link
        href="/admin/domande"
        className="mx-auto mt-5 inline-flex h-12 items-center rounded-2xl bg-mc-red px-6 font-black text-white"
      >
        Torna alle domande
      </Link>
    </div>
  );
}
