import { PrizePhotos } from "@/components/admin/PrizePhotos";
import { StockManager } from "@/components/admin/StockManager";
import { listPrizeSettings } from "@/lib/services/prizes";
import { listRestaurants } from "@/lib/services/quiz";

export const dynamic = "force-dynamic";

export default async function PrizesPage() {
  const [prizes, restaurants] = await Promise.all([listPrizeSettings(), listRestaurants()]);
  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-black text-ink sm:text-3xl">Premi e scorte</h1>
        <p className="font-semibold text-ink-soft">
          Dopo la scelta della casetta il premio viene estratto a caso tra quelli ancora disponibili nel ristorante del
          dispositivo, in proporzione ai pezzi rimasti. Nome, messaggio e foto valgono per tutti i ristoranti.
        </p>
      </div>
      <StockManager prizes={prizes} restaurants={restaurants} />
      <h2 className="pt-2 text-xl font-black">Nome, messaggio e foto</h2>
      <PrizePhotos prizes={prizes} />
    </div>
  );
}
