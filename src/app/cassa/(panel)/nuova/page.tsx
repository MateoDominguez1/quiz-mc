import { NewEntry } from "@/components/cassa/NewEntry";

export default function NewEntryPage() {
  return (
    <div className="animate-fade-up space-y-5">
      <h1 className="text-center text-2xl font-black text-ink sm:text-3xl">Nuova partecipazione</h1>
      <NewEntry />
    </div>
  );
}
