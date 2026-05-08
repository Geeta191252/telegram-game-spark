import { motion } from "framer-motion";
import { Clock, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { initiatePayment, getTelegram } from "@/lib/telegram";
import { useBalanceContext } from "@/contexts/BalanceContext";
import { useEffect, useState } from "react";

interface MarketScreenProps {
  onGoToWallet?: () => void;
}

interface BackendOffer {
  _id: string;
  title: string;
  payAmount: number;
  payCurrency: "star" | "dollar";
  getAmount: number;
  bonusLabel?: string;
  valueLabel?: string;
}

const apiBase = import.meta.env.VITE_API_BASE_URL || "https://broken-bria-chetan1-ea890b93.koyeb.app/api";

const gradientFor = (idx: number) => {
  const list = [
    "linear-gradient(135deg, hsl(280 75% 45%), hsl(310 70% 40%))",
    "linear-gradient(135deg, hsl(140 65% 38%), hsl(170 60% 35%))",
    "linear-gradient(135deg, hsl(25 90% 45%), hsl(45 95% 45%))",
    "linear-gradient(135deg, hsl(200 75% 45%), hsl(220 70% 40%))",
  ];
  return list[idx % list.length];
};
const badgeFor = (idx: number) => {
  const list = [
    "linear-gradient(135deg, hsl(45 95% 55%), hsl(35 90% 50%))",
    "linear-gradient(135deg, hsl(0 80% 55%), hsl(15 80% 50%))",
    "linear-gradient(135deg, hsl(280 70% 55%), hsl(310 65% 50%))",
    "linear-gradient(135deg, hsl(140 70% 45%), hsl(170 60% 40%))",
  ];
  return list[idx % list.length];
};

const MarketScreen = ({ onGoToWallet }: MarketScreenProps) => {
  const { refreshBalance } = useBalanceContext();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [offers, setOffers] = useState<BackendOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${apiBase}/offers`);
        const d = await r.json();
        setOffers(d.offers || []);
      } catch {
        setOffers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const claimStarOffer = async (offer: BackendOffer) => {
    setBusyId(offer._id);
    try {
      await initiatePayment("deposit", "star", offer.payAmount, (status) => {
        setBusyId(null);
        if (status === "paid") {
          toast({ title: "Offer paid! 🎁", description: `${offer.bonusLabel || "Bonus"} will be credited by admin shortly.` });
          refreshBalance();
        } else if (status === "cancelled") {
          toast({ title: "Cancelled", description: "Offer payment cancelled." });
        }
      });
    } catch (err: any) {
      setBusyId(null);
      toast({ title: "Error", description: err?.message || "Could not start payment.", variant: "destructive" });
    }
  };

  const claimDollarOffer = async (offer: BackendOffer) => {
    setBusyId(offer._id);
    try {
      const tg = getTelegram();
      const userId = tg?.initDataUnsafe?.user?.id || "demo";
      const res = await fetch(`${apiBase}/crypto/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount: offer.payAmount, currency: "btc" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");
      toast({
        title: "Offer Started! 🪙",
        description: `Pay ${data.payAmount} BTC in Wallet → Crypto. ${offer.bonusLabel || "Bonus"} after confirmation.`,
      });
      onGoToWallet?.();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Could not start offer.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const claim = (offer: BackendOffer) =>
    offer.payCurrency === "star" ? claimStarOffer(offer) : claimDollarOffer(offer);

  return (
    <div className="relative z-10 px-3 pt-3 pb-24 space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-3 flex items-center gap-3"
        style={{
          background: "linear-gradient(135deg, hsla(45, 90%, 55%, 0.25), hsla(25, 80%, 50%, 0.2), hsla(0, 75%, 50%, 0.15))",
          border: "1px solid hsla(45, 70%, 55%, 0.25)",
        }}
      >
        <span className="text-3xl">🏪</span>
        <div>
          <h2 className="font-bold text-base" style={{ color: "hsl(45 95% 70%)" }}>Market — Special Offers</h2>
          <p className="text-[11px]" style={{ color: "hsl(260 30% 75%)" }}>Add more, get more!</p>
        </div>
      </motion.div>

      {loading ? (
        <p className="text-center text-sm py-8" style={{ color: "hsl(260 30% 70%)" }}>Loading offers…</p>
      ) : offers.length === 0 ? (
        <div className="rounded-2xl p-6 text-center" style={{
          background: "hsla(260, 40%, 25%, 0.5)",
          border: "1px dashed hsla(280, 50%, 50%, 0.3)",
        }}>
          <div className="text-4xl mb-2">📭</div>
          <p className="text-sm font-bold" style={{ color: "hsl(45 90% 70%)" }}>No active offers right now</p>
          <p className="text-[11px] mt-1" style={{ color: "hsl(260 30% 70%)" }}>Check back soon for special deals!</p>
        </div>
      ) : (
        offers.map((offer, idx) => {
          const payDisp = offer.payCurrency === "star" ? `${offer.payAmount} ⭐` : `$${offer.payAmount}`;
          const getDisp = offer.payCurrency === "star" ? `${offer.getAmount} ⭐` : `$${offer.getAmount}`;
          return (
            <motion.div
              key={offer._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="rounded-3xl p-1"
              style={{
                background: "linear-gradient(135deg, hsl(45 95% 55%), hsl(25 85% 50%), hsl(0 75% 55%))",
                boxShadow: "0 10px 30px hsla(25, 85%, 45%, 0.4)",
              }}
            >
              <div className="rounded-[22px] overflow-hidden" style={{ background: gradientFor(idx) }}>
                <div className="text-center py-2.5" style={{
                  background: "linear-gradient(135deg, hsl(45 95% 55%), hsl(35 90% 50%))",
                  borderBottom: "2px solid hsl(25 85% 40%)",
                }}>
                  <h3 className="font-black text-lg tracking-wide" style={{
                    color: "hsl(0 0% 100%)",
                    textShadow: "2px 2px 0 hsl(25 85% 35%), -1px -1px 0 hsl(25 85% 35%)",
                  }}>
                    {offer.title}
                  </h3>
                </div>

                <div className="flex justify-center -mt-1 mb-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{
                    background: "hsla(0, 0%, 0%, 0.4)",
                    border: "1px solid hsla(45, 80%, 55%, 0.4)",
                  }}>
                    <Clock className="h-3 w-3" style={{ color: "hsl(45 90% 65%)" }} />
                    <span className="text-[11px] font-bold" style={{ color: "hsl(45 90% 75%)" }}>Limited</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 px-4 pb-3 relative">
                  <div className="flex-1 rounded-2xl py-3 text-center" style={{
                    background: "hsla(0, 0%, 0%, 0.35)",
                    border: "1px solid hsla(0, 0%, 100%, 0.1)",
                  }}>
                    <div className="text-2xl mb-1">💰</div>
                    <div className="font-black text-base" style={{ color: "hsl(0 0% 100%)" }}>{payDisp}</div>
                    <div className="text-[10px] opacity-70" style={{ color: "hsl(0 0% 100%)" }}>You Pay</div>
                  </div>
                  <div className="text-2xl font-black" style={{ color: "hsl(45 95% 60%)" }}>+</div>
                  <div className="flex-1 rounded-2xl py-3 text-center relative" style={{
                    background: "hsla(0, 0%, 0%, 0.35)",
                    border: "1px solid hsla(45, 80%, 55%, 0.4)",
                  }}>
                    <div className="text-2xl mb-1">{offer.payCurrency === "star" ? "⭐" : "💵"}</div>
                    <div className="font-black text-base" style={{ color: "hsl(45 95% 70%)" }}>{getDisp}</div>
                    <div className="text-[10px] opacity-70" style={{ color: "hsl(0 0% 100%)" }}>You Get</div>
                    {offer.valueLabel && (
                      <div className="absolute -right-1 -top-1 px-2 py-0.5 rounded-md text-[9px] font-black" style={{
                        background: badgeFor(idx),
                        color: "hsl(0 0% 100%)",
                        boxShadow: "0 2px 8px hsla(0, 0%, 0%, 0.3)",
                      }}>
                        {offer.valueLabel}
                      </div>
                    )}
                  </div>
                </div>

                {offer.bonusLabel && (
                  <div className="text-center pb-2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "hsl(45 95% 70%)" }}>
                      <Sparkles className="h-3.5 w-3.5" />
                      Bonus {offer.bonusLabel}
                    </span>
                  </div>
                )}

                <div className="px-4 pb-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    disabled={busyId === offer._id}
                    onClick={() => claim(offer)}
                    className="w-full rounded-2xl py-3 font-black text-base disabled:opacity-60"
                    style={{
                      background: "linear-gradient(135deg, hsl(140 75% 45%), hsl(150 70% 40%))",
                      color: "hsl(0 0% 100%)",
                      textShadow: "1px 1px 0 hsla(0, 0%, 0%, 0.3)",
                      boxShadow: "0 6px 20px hsla(140, 70%, 40%, 0.5), inset 0 -3px 0 hsla(0, 0%, 0%, 0.25)",
                    }}
                  >
                    {busyId === offer._id ? "Processing..." : `Buy ${payDisp} → Get ${getDisp}`}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
        })
      )}

      {offers.length > 0 && (
        <p className="text-center text-[10px] px-4" style={{ color: "hsl(260 25% 65%)" }}>
          After payment, bonus will be credited automatically by admin.
        </p>
      )}
    </div>
  );
};

export default MarketScreen;
