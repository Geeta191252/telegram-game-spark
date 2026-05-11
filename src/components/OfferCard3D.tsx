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
  const symbol = isDollar ? "$" : "⭐";
  const payDisp = isDollar ? `$${offer.payAmount}` : `${offer.payAmount} ⭐`;
  const title = offer.title || (isDollar ? "MEGA DEAL" : "SPECIAL OFFER");

  // Parse bonus label e.g. "+$10 +50 ⭐" to surface a single visible "+X" tile next to the Get
  const bonusText = (offer.bonusLabel || "").trim();

  return (
    <div className="relative w-full">
      {/* Full 3D hero image, no crop */}
      <img
        src={heroImg}
        alt={title}
        className="w-full h-auto block"
        style={{ filter: "drop-shadow(0 14px 40px hsla(0,0%,0%,0.55))" }}
      />

      {/* Dynamic info overlay placed in the empty bottom area of the hero image */}
      <div
        className="absolute left-1/2 -translate-x-1/2 px-4 py-3 rounded-2xl flex flex-col items-center gap-1.5"
        style={{
          top: "60%",
          background: "linear-gradient(135deg, hsla(260,55%,10%,0.85), hsla(280,60%,14%,0.85))",
          border: "2px solid hsla(45,90%,60%,0.85)",
          boxShadow: "0 6px 18px hsla(0,0%,0%,0.55)",
          width: "78%",
        }}
      >
        {/* pay + bonus */}
        <div className="flex items-center gap-2">
          <span
            className="font-black text-[26px] leading-none"
            style={{ color: "hsl(0 0% 100%)", textShadow: "2px 2px 0 hsla(0,0%,0%,0.5)" }}
          >
            {offer.payAmount}
          </span>
          {(() => {
            const m = (offer.bonusLabel || "").match(/\+?\s*(\d+(?:\.\d+)?)\s*⭐/);
            const bStar = m ? parseFloat(m[1]) : 0;
            const m2 = (offer.bonusLabel || "").match(/\+\s*\$\s*(\d+(?:\.\d+)?)/);
            const bDol = m2 ? parseFloat(m2[1]) : 0;
            const bonusDisp = isDollar
              ? bDol > 0 ? `$${bDol}` : bStar > 0 ? `${bStar} ⭐` : ""
              : bStar > 0 ? `${bStar}` : "";
            return bonusDisp ? (
              <>
                <span className="font-black text-[24px] leading-none" style={{ color: "hsl(45 95% 65%)" }}>+</span>
                <span
                  className="font-black text-[26px] leading-none"
                  style={{ color: "hsl(140 80% 60%)", textShadow: "2px 2px 0 hsla(0,0%,0%,0.5)" }}
                >
                  {bonusDisp}
                </span>
              </>
            ) : null;
          })()}
          <span className="text-[22px] leading-none">{symbol}</span>
        </div>

        {/* strikethrough "regular" = getAmount */}
        <div className="flex items-center gap-1.5">
          <span
            className="font-bold text-[16px] line-through decoration-[2.5px]"
            style={{ color: "hsl(0 80% 70%)", textDecorationColor: "hsl(0 90% 55%)" }}
          >
            {offer.getAmount} {symbol}
          </span>
          {offer.valueLabel && (
            <span
              className="font-black text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: "linear-gradient(135deg, hsl(0 85% 55%), hsl(15 85% 48%))",
                color: "hsl(0 0% 100%)",
                textShadow: "1px 1px 0 hsla(0,0%,0%,0.4)",
              }}
            >
              {offer.valueLabel}
            </span>
          )}
        </div>
      </div>

      {/* Tap-to-buy overlay button positioned over the green button area */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        disabled={busy}
        onClick={onClaim}
        aria-label={`Pay ${payDisp}`}
        className="absolute left-[8%] right-[8%] bottom-[3%] rounded-full disabled:opacity-60 flex items-center justify-center"
        style={{
          height: "11%",
          background: busy
            ? "hsla(140,60%,40%,0.55)"
            : "linear-gradient(135deg, hsl(140 80% 45%), hsl(150 75% 38%))",
          boxShadow: "0 6px 16px hsla(140,70%,30%,0.55)",
          border: "2px solid hsla(45,90%,60%,0.8)",
        }}
      >
        <span
          className="font-black text-lg"
          style={{ color: "hsl(0 0% 100%)", textShadow: "1px 1px 0 hsla(0,0%,0%,0.4)" }}
        >
          {busy ? "Processing…" : `Pay ${payDisp}`}
        </span>
      </motion.button>
    </div>
  );
};

export default OfferCard3D;
