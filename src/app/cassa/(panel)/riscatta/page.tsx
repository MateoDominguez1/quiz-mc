import { RedeemPrize } from "@/components/cassa/RedeemPrize";

export default function RedeemPage() {
  return (
    <div className="animate-fade-up space-y-5">
      <h1 className="text-center text-2xl font-black text-ink sm:text-3xl">Riscatta un premio</h1>
      <RedeemPrize />
    </div>
  );
}
