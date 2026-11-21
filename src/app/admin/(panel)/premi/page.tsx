import { PrizePhotos } from "@/components/admin/PrizePhotos";
import { listPrizeSettings } from "@/lib/services/prizes";

export const dynamic = "force-dynamic";

export default async function PrizesPage() {
  const prizes = await listPrizeSettings();
  return (
    <div className="animate-fade-up space-y-5">
      <div>
        <h1 className="text-2xl font-black text-ink sm:text-3xl">Premi e scorte</h1>
        <p className="font-semibold text-ink-soft">
          Dopo la scelta della casetta il premio viene estratto a caso tra quelli ancora disponibili, in proporzione ai pezzi
          rimasti. Puoi cambiare nome, messaggio, foto e pezzi disponibili di ogni premio; le foto vengono ridimensionate
          prima del caricamento.
        </p>
      </div>
      <PrizePhotos prizes={prizes} />
    </div>
  );
}
