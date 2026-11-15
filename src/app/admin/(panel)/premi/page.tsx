import { PrizePhotos } from "@/components/admin/PrizePhotos";
import { listPrizeSettings } from "@/lib/services/prizes";

export const dynamic = "force-dynamic";

export default async function PrizesPage() {
  const prizes = await listPrizeSettings();
  return (
    <div className="animate-fade-up space-y-5">
      <div>
        <h1 className="text-2xl font-black text-ink sm:text-3xl">Premi e foto</h1>
        <p className="font-semibold text-ink-soft">
          Il premio viene assegnato automaticamente in base all&apos;età. Le foto vengono ridimensionate per gli smartphone
          prima del caricamento.
        </p>
      </div>
      <PrizePhotos prizes={prizes} />
    </div>
  );
}
