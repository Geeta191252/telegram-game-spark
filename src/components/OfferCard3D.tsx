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

      {/* Dynamic 3D-styled overlay: % VALUE badge, pay+bonus tiles, strikethrough total */}
      {(() => {
        const mStar = (offer.bonusLabel || "").match(/\+?\s*(\d+(?:\.\d+)?)\s*⭐/);
        const bStar = mStar ? parseFloat(mStar[1]) : 0;
        const mDol = (offer.bonusLabel || "").match(/\+\s*\$\s*(\d+(?:\.\d+)?)/);
        const bDol = mDol ? parseFloat(mDol[1]) : 0;
        const bonusPrimary = isDollar
          ? bDol > 0 ? `$${bDol}` : bStar > 0 ? `${bStar}` : ""
          : bStar > 0 ? `${bStar}` : "";
        const showBonus = bonusPrimary !== "";
        const tileIcon = isDollar ? "💰" : "⭐";
        const total = offer.payAmount + (isDollar ? bDol : bStar);

        return (
          <>
          {/* Title in top banner */}
          <div
            className="absolute left-0 right-0 flex justify-center"
            style={{ top: "6%" }}
          >
            <span
              className="font-black text-2xl tracking-wide"
              style={{
                color: "hsl(45 100% 65%)",
                textShadow: "2px 2px 0 hsla(0,0%,0%,0.7), 0 0 8px hsla(45,90%,55%,0.6)",
                WebkitTextStroke: "1px hsl(30 80% 30%)",
              }}
            >
              {title}
            </span>
          </div>
          <div
            className="absolute left-0 right-0 flex flex-col items-center"
            style={{ top: "60%" }}
          >
            {/* % VALUE ribbon (e.g. 40% VALUE) */}
            {offer.valueLabel && (
              <div
                className="font-black text-base px-5 py-1.5 rounded-full mb-2"
                style={{
                  background: "linear-gradient(135deg, hsl(330 80% 50%), hsl(345 85% 48%))",
                  color: "hsl(45 100% 70%)",
                  textShadow: "2px 2px 0 hsla(0,0%,0%,0.55)",
                  border: "2px solid hsl(45 95% 60%)",
                  boxShadow: "0 4px 10px hsla(0,0%,0%,0.4)",
                }}
              >
                {offer.valueLabel}
              </div>
            )}

            {/* Pay + bonus tiles */}
            <div className="flex items-center gap-2 px-4">
              <div
                className="rounded-2xl px-3 py-2 flex flex-col items-center justify-center"
                style={{
                  background: "linear-gradient(180deg, hsl(260 50% 20%), hsl(270 55% 14%))",
                  border: "3px solid hsl(45 90% 55%)",
                  boxShadow: "0 4px 0 hsla(0,0%,0%,0.4), inset 0 2px 0 hsla(45,90%,75%,0.4)",
                  minWidth: "72px",
                }}
              >
                <span className="text-3xl leading-none" style={{ filter: "drop-shadow(0 2px 2px hsla(0,0%,0%,0.5))" }}>{tileIcon}</span>
                <span className="font-black text-xl leading-none mt-0.5" style={{ color: "hsl(0 0% 100%)", textShadow: "2px 2px 0 hsla(0,0%,0%,0.6)" }}>
                  {offer.payAmount}
                </span>
              </div>

              {showBonus && (
                <>
                  <span className="font-black text-3xl" style={{ color: "hsl(45 95% 65%)", textShadow: "2px 2px 0 hsla(0,0%,0%,0.5)" }}>+</span>
                  <div
                    className="rounded-2xl px-3 py-2 flex flex-col items-center justify-center"
                    style={{
                      background: "linear-gradient(180deg, hsl(260 50% 20%), hsl(270 55% 14%))",
                      border: "3px solid hsl(45 90% 55%)",
                      boxShadow: "0 4px 0 hsla(0,0%,0%,0.4), inset 0 2px 0 hsla(45,90%,75%,0.4)",
                      minWidth: "72px",
                    }}
                  >
                    <span className="text-3xl leading-none" style={{ filter: "drop-shadow(0 2px 2px hsla(0,0%,0%,0.5))" }}>
                      {isDollar && bDol > 0 ? "💰" : "⭐"}
                    </span>
                    <span className="font-black text-xl leading-none mt-0.5" style={{ color: "hsl(0 0% 100%)", textShadow: "2px 2px 0 hsla(0,0%,0%,0.6)" }}>
                      {bonusPrimary}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Strikethrough total = pay + bonus (auto) */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-base leading-none">{symbol}</span>
              <span
                className="font-black text-xl line-through decoration-[3px]"
                style={{ color: "hsl(0 0% 95%)", textDecorationColor: "hsl(0 90% 55%)", textShadow: "1px 1px 0 hsla(0,0%,0%,0.5)" }}
              >
                {total}
              </span>
            </div>
          </div>
          </>
        );
      })()}


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
