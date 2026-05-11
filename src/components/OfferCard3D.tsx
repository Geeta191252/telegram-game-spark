import { motion } from "framer-motion";
import megaDealImg from "@/assets/offers/mega-deal-dollar.png";
import specialOfferImg from "@/assets/offers/special-offer-star.png";

export interface OfferCard3DData {
  _id: string;
  title?: string;
  payAmount: number;
  payCurrency: "star" | "dollar";
  getAmount: number;
  bonusLabel?: string;
  valueLabel?: string;
}

interface Props {
  offer: OfferCard3DData;
  onClaim: () => void;
  busy?: boolean;
  compact?: boolean;
}

const OfferCard3D = ({ offer, onClaim, busy }: Props) => {
  const isDollar = offer.payCurrency === "dollar";
  const heroImg = isDollar ? megaDealImg : specialOfferImg;
  const payDisp = isDollar ? `$${offer.payAmount}` : `${offer.payAmount} ⭐`;

  return (
    <div className="relative w-full">
      {/* Full 3D hero image, no crop */}
      <img
        src={heroImg}
        alt={offer.title || (isDollar ? "Mega Deal" : "Special Offer")}
        className="w-full h-auto block"
        style={{ filter: "drop-shadow(0 14px 40px hsla(0,0%,0%,0.55))" }}
      />

      {/* Tap-to-buy overlay button positioned over the green button area */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        disabled={busy}
        onClick={onClaim}
        aria-label={`Pay ${payDisp}`}
        className="absolute left-[8%] right-[8%] bottom-[3%] rounded-full disabled:opacity-60"
        style={{
          height: "11%",
          background: busy ? "hsla(140,60%,40%,0.4)" : "transparent",
        }}
      >
        {busy && (
          <span
            className="font-black text-lg"
            style={{ color: "hsl(0 0% 100%)", textShadow: "1px 1px 0 hsla(0,0%,0%,0.4)" }}
          >
            Processing…
          </span>
        )}
      </motion.button>
    </div>
  );
};

export default OfferCard3D;
