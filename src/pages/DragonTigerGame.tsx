import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  playBetSound,
  playSpinSound,
  playWinSound,
  playLoseSound,
  playResultReveal,
  startBgMusic,
  stopBgMusic,
} from "@/hooks/useGameSounds";
import { useBalanceContext } from "@/contexts/BalanceContext";
import { reportGameResult } from "@/lib/telegram";
import arenaBg from "@/assets/dragon-tiger/arena-bg.png";
import chip1Img from "@/assets/dragon-tiger/chip-1.png";
import chip10Img from "@/assets/dragon-tiger/chip-10.png";
import chip50Img from "@/assets/dragon-tiger/chip-50.png";
import chip100Img from "@/assets/dragon-tiger/chip-100.png";
import chip500Img from "@/assets/dragon-tiger/chip-500.png";

type Side = "dragon" | "tiger" | "tie";
type Phase = "betting" | "dealing" | "result";
const BETTING_SECONDS = 15;
const RESULT_SECONDS = 3;

interface CardData { rank: number; suit: number; }
const SUITS = [
  { s: "♥", color: "hsl(0 80% 48%)" },
  { s: "♦", color: "hsl(0 80% 48%)" },
  { s: "♣", color: "hsl(0 0% 12%)" },
  { s: "♠", color: "hsl(0 0% 12%)" },
];
const RANK_LABELS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const CHIP_VALUES = [1, 10, 50, 100, 500];
const CHIP_HIT_POSITIONS = [19.7, 36.2, 50.9, 66.5, 81.9];
const CHIP_IMAGES = [chip1Img, chip10Img, chip50Img, chip100Img, chip500Img];

// Image intrinsic aspect ratio (width / height)
const BG_W = 768;
const BG_H = 1376;
const DRAGON_WIN_EFFECT_SRC = "/effects/dt-blue-keyed.webm";
const TIGER_WIN_EFFECT_SRC = "/effects/dt-orange-keyed.webm";

const DragonTigerGame = () => {
  const navigate = useNavigate();
  const [soundOn] = useState(true);
  const soundRef = useRef(true);

  const { dollarBalance, starBalance, dollarWinning, starWinning, refreshBalance } = useBalanceContext();
  const [localDollarAdj, setLocalDollarAdj] = useState(0);
  const [localStarAdj, setLocalStarAdj] = useState(0);
  const gameDollar = dollarBalance + dollarWinning + localDollarAdj;
  const gameStar = starBalance + starWinning + localStarAdj;

  const [activeWallet, setActiveWallet] = useState<"dollar" | "star">("dollar");
  const currentBalance = activeWallet === "dollar" ? gameDollar : gameStar;

  const [bets, setBets] = useState<{ dragon: number; tiger: number; tie: number }>({ dragon: 0, tiger: 0, tie: 0 });
  const [lastBets, setLastBets] = useState<{ dragon: number; tiger: number; tie: number } | null>(null);
  const [chip, setChip] = useState(10);
  const [betFeedback, setBetFeedback] = useState<{ side: Side; key: number; kind: "success" | "error" } | null>(null);
  const [betStatus, setBetStatus] = useState("");
  const [betTimer, setBetTimer] = useState(15);

  const [phase, setPhase] = useState<Phase>("betting");
  const [dragonCard, setDragonCard] = useState<CardData | null>(null);
  const [tigerCard, setTigerCard] = useState<CardData | null>(null);
  const [winner, setWinner] = useState<Side | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  const [winEffectKey, setWinEffectKey] = useState(0);
  const [resultTimer, setResultTimer] = useState(15);
  const [history, setHistory] = useState<Side[]>(["dragon","tiger","tiger","tiger","tiger","tiger","dragon","tiger","dragon","dragon"]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dealLockedRef = useRef(false);
  const latestRoundRef = useRef({ phase, bets, activeWallet, currentBalance });
  latestRoundRef.current = { phase, bets, activeWallet, currentBalance };

  const clearRoundTimeouts = () => {
    roundTimeoutsRef.current.forEach(clearTimeout);
    roundTimeoutsRef.current = [];
  };

  useEffect(() => { if (soundOn) startBgMusic(); else stopBgMusic(); return () => stopBgMusic(); }, [soundOn]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); clearRoundTimeouts(); }, []);
  useEffect(() => {
    [DRAGON_WIN_EFFECT_SRC, TIGER_WIN_EFFECT_SRC].forEach((src) => {
      const video = document.createElement("video");
      video.src = src;
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.load();
    });
  }, []);
  useEffect(() => { if (phase === "betting") dealLockedRef.current = false; }, [phase]);

  useEffect(() => {
    if (phase !== "betting") return;
    setBetTimer(BETTING_SECONDS);
    const id = setInterval(() => {
      setBetTimer((t) => {
        if (t <= 1) {
          clearInterval(id);
          setTimeout(() => deal(), 0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const totalBet = bets.dragon + bets.tiger + bets.tie;
  const sym = activeWallet === "dollar" ? "$" : "⭐";

  const addBet = (side: Side) => {
    if (phase !== "betting") {
      toast.error("Round in progress, wait for next round");
      return;
    }
    if (currentBalance < totalBet + chip) {
      setBetFeedback((p) => ({ side, key: (p?.key ?? 0) + 1, kind: "error" }));
      setBetStatus("LOW BALANCE");
      toast.error(`Insufficient ${activeWallet === "dollar" ? "$" : "⭐"} balance — please deposit`);
      return;
    }
    setBets((p) => ({ ...p, [side]: p[side] + chip }));
    setBetFeedback((p) => ({ side, key: (p?.key ?? 0) + 1, kind: "success" }));
    setBetStatus(`+${sym}${chip}`);
    if (soundRef.current) playBetSound();
  };
  const selectChip = (value: number) => {
    if (phase !== "betting") {
      toast.error("Round in progress, wait for next round");
      return;
    }
    setChip(value);
    setBetStatus(`${sym}${value}`);
    if (soundRef.current) playBetSound();
  };
  const doubleAllBets = () => {
    if (phase !== "betting" || totalBet === 0) return;
    if (currentBalance < totalBet * 2) {
      toast.error("Insufficient balance to double");
      return;
    }
    setBets((p) => ({ dragon: p.dragon * 2, tiger: p.tiger * 2, tie: p.tie * 2 }));
    if (soundRef.current) playBetSound();
  };
  const repeatBets = () => {
    if (phase !== "betting" || !lastBets) return;
    const total = lastBets.dragon + lastBets.tiger + lastBets.tie;
    if (currentBalance < total) {
      toast.error("Insufficient balance to repeat");
      return;
    }
    setBets(lastBets);
    if (soundRef.current) playBetSound();
  };

  const deal = () => {
    if (dealLockedRef.current) return;
    const snapshot = latestRoundRef.current;
    const roundBets = snapshot.bets;
    const roundTotalBet = roundBets.dragon + roundBets.tiger + roundBets.tie;
    const roundWallet = snapshot.activeWallet;
    if (snapshot.phase !== "betting") return;
    if (roundTotalBet > 0 && snapshot.currentBalance < roundTotalBet) return;
    dealLockedRef.current = true;
    if (roundTotalBet > 0) {
      if (roundWallet === "dollar") setLocalDollarAdj((p) => p - roundTotalBet); else setLocalStarAdj((p) => p - roundTotalBet);
    }
    clearRoundTimeouts();
    if (soundRef.current) playSpinSound();
    setLastBets(roundBets);
    setPhase("dealing");
    setDragonCard(null); setTigerCard(null); setWinner(null);

    let wDragon = 47, wTiger = 47, wTie = 6;
    if (roundBets.dragon > 0) wDragon *= 0.45;
    if (roundBets.tiger > 0) wTiger *= 0.45;
    if (roundBets.tie > 0) wTie *= 0.3;
    if (roundBets.dragon > 0 && roundBets.tiger === 0 && roundBets.tie === 0) wTiger *= 1.6;
    if (roundBets.tiger > 0 && roundBets.dragon === 0 && roundBets.tie === 0) wDragon *= 1.6;

    let r = Math.random() * (wDragon + wTiger + wTie);
    let outcome: Side = "dragon";
    if ((r -= wDragon) < 0) outcome = "dragon";
    else if ((r -= wTiger) < 0) outcome = "tiger";
    else outcome = "tie";

    let dRank: number, tRank: number;
    if (outcome === "tie") { dRank = Math.floor(Math.random() * 13) + 1; tRank = dRank; }
    else if (outcome === "dragon") {
      dRank = Math.floor(Math.random() * 12) + 2;
      tRank = Math.floor(Math.random() * (dRank - 1)) + 1;
    } else {
      tRank = Math.floor(Math.random() * 12) + 2;
      dRank = Math.floor(Math.random() * (tRank - 1)) + 1;
    }
    const finalDragon = { rank: dRank, suit: Math.floor(Math.random() * 4) };
    const finalTiger = { rank: tRank, suit: Math.floor(Math.random() * 4) };

    roundTimeoutsRef.current = [
      setTimeout(() => { setDragonCard(finalDragon); if (soundRef.current) playResultReveal(); }, 700),
      setTimeout(() => { setTigerCard(finalTiger); if (soundRef.current) playResultReveal(); }, 1500),
      setTimeout(() => {
      let payout = 0;
      if (outcome === "dragon") payout = roundBets.dragon * 2;
      else if (outcome === "tiger") payout = roundBets.tiger * 2;
      else payout = roundBets.tie * 9 + (roundBets.dragon + roundBets.tiger) * 0.5;
      payout = Math.round(payout * 100) / 100;
      const profit = payout - roundTotalBet;

      setWinner(outcome);
      setWinEffectKey((k) => k + 1);
      setHistory((h) => [outcome, ...h].slice(0, 10));

      if (payout > 0) {
        setWinAmount(payout);
        if (profit > 0 && soundRef.current) playWinSound();
        else if (soundRef.current) playLoseSound();
      } else {
        setWinAmount(0);
        if (soundRef.current) playLoseSound();
      }

      if (roundTotalBet > 0) {
        reportGameResult({ betAmount: roundTotalBet, winAmount: payout, currency: roundWallet, game: "dragon-tiger" })
          .then(() => { setLocalDollarAdj(0); setLocalStarAdj(0); refreshBalance(); })
          .catch(console.error);
      }

      setPhase("result");
      setResultTimer(RESULT_SECONDS);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setResultTimer((p) => {
          if (p <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setBets({ dragon: 0, tiger: 0, tie: 0 });
            setDragonCard(null); setTigerCard(null); setWinner(null);
            setPhase("betting");
            return 0;
          }
          return p - 1;
        });
      }, 1000);
      }, 2400),
    ];
  };

  const renderCard = (card: CardData | null) => (
    <div style={{ perspective: 800, width: "100%", height: "100%" }}>
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: card ? 0 : 180 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        <div
          className="absolute inset-0 rounded-md flex flex-col items-start justify-between p-1"
          style={{
            backfaceVisibility: "hidden",
            background: "linear-gradient(160deg, hsl(45 30% 96%), hsl(40 25% 88%))",
            border: "1.5px solid hsl(45 60% 70%)",
            boxShadow: "0 4px 14px hsla(0,0%,0%,0.55)",
          }}
        >
          {card && (
            <>
              <div className="leading-none">
                <div className="font-black text-base leading-none" style={{ color: SUITS[card.suit].color }}>{RANK_LABELS[card.rank - 1]}</div>
                <div className="text-xs leading-none" style={{ color: SUITS[card.suit].color }}>{SUITS[card.suit].s}</div>
              </div>
              <div className="self-center text-2xl leading-none" style={{ color: SUITS[card.suit].color }}>{SUITS[card.suit].s}</div>
              <div className="self-end leading-none rotate-180">
                <div className="font-black text-base leading-none" style={{ color: SUITS[card.suit].color }}>{RANK_LABELS[card.rank - 1]}</div>
                <div className="text-xs leading-none" style={{ color: SUITS[card.suit].color }}>{SUITS[card.suit].s}</div>
              </div>
            </>
          )}
        </div>
        <div
          className="absolute inset-0 rounded-md"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: "repeating-linear-gradient(45deg, hsl(220 80% 28%) 0 5px, hsl(220 75% 22%) 5px 10px)",
            border: "1.5px solid hsl(45 90% 55%)",
          }}
        />
      </motion.div>
    </div>
  );

  const replayWinVideo = (node: HTMLVideoElement | null) => {
    if (!node) return;
    node.currentTime = 0;
    const playPromise = node.play();
    if (playPromise) playPromise.catch(() => undefined);
  };

  const chipImageForAmount = (amount: number) => {
    if (amount >= 500) return chip500Img;
    if (amount >= 100) return chip100Img;
    if (amount >= 50) return chip50Img;
    if (amount >= 10) return chip10Img;
    return chip1Img;
  };

  const renderPlacedBet = (side: Side, amount: number) => {
    if (amount <= 0) return null;
    const accent = side === "dragon" ? "210 100% 60%" : side === "tiger" ? "22 100% 56%" : "130 85% 55%";
    return (
      <motion.div
        key={`${side}-${amount}`}
        initial={{ opacity: 0, y: 12, scale: 0.72, rotateX: 42 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          top: side === "tie" ? "48%" : "45%",
          width: side === "tie" ? "16%" : "24%",
          aspectRatio: "1/1",
          transform: "translate(-50%, -50%)",
          transformStyle: "preserve-3d",
          zIndex: 4,
          filter: `drop-shadow(0 0 12px hsl(${accent} / 0.75)) drop-shadow(0 12px 10px hsl(0 0% 0% / 0.58))`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${chipImageForAmount(amount)})`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            transform: "rotateX(14deg) translateZ(14px)",
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center font-black whitespace-nowrap"
          style={{
            bottom: "-16%",
            minWidth: "150%",
            padding: "2px 7px",
            borderRadius: 999,
            background: "linear-gradient(180deg, hsl(48 95% 72%), hsl(33 96% 48%))",
            color: "hsl(28 80% 13%)",
            fontSize: "min(3vw, 14px)",
            textShadow: "0 1px 0 hsl(52 100% 82% / 0.7)",
            boxShadow: "inset 0 1px 1px hsl(0 0% 100% / 0.55), 0 5px 10px hsl(0 0% 0% / 0.55)",
          }}
        >
          {sym}{amount}
        </div>
      </motion.div>
    );
  };

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: "hsl(220 40% 5%)" }}
    >
      <div
        className="relative"
        style={{
          height: `min(100vh, calc(100vw * ${BG_H} / ${BG_W}))`,
          width: `min(100vw, calc(100vh * ${BG_W} / ${BG_H}))`,
        }}
      >
        {/* 3D TABLE BACKGROUND */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ perspective: "1500px", perspectiveOrigin: "50% 28%" }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: "translateZ(0)",
              transformStyle: "preserve-3d",
              transformOrigin: "50% 40%",
              filter: "drop-shadow(0 34px 44px hsl(0 0% 0% / 0.72)) drop-shadow(0 0 50px hsl(38 100% 56% / 0.2))",
            }}
          >
            <img
              src={arenaBg}
              alt="Dragon vs Tiger arena"
              className="absolute inset-0 w-full h-full object-fill select-none"
              draggable={false}
            />
            {/* Top vignette / ambient highlight */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 62% 32% at 50% 12%, hsl(45 95% 70% / 0.16), transparent 72%), radial-gradient(ellipse 90% 48% at 50% 92%, hsl(0 0% 0% / 0.5), transparent 62%)",
                mixBlendMode: "screen",
              }}
            />
            {/* Specular sheen sweep */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(120deg, transparent 35%, hsla(45,90%,80%,0.10) 50%, transparent 65%)",
                mixBlendMode: "overlay",
              }}
            />
          </div>
        </div>

        {/* TOP-LEFT BACK BUTTON */}
        <button
          onClick={() => navigate("/")}
          className="absolute"
          style={{ left: "2.5%", top: "1.5%", width: "8%", aspectRatio: "1/1", borderRadius: "50%" }}
          aria-label="Back"
        />

        {/* TOP-RIGHT SETTINGS / STATS */}
        <button
          onClick={() => {}}
          className="absolute"
          style={{ right: "12%", top: "1.5%", width: "8%", aspectRatio: "1/1", borderRadius: "50%" }}
          aria-label="Stats"
        />
        <button
          onClick={() => {}}
          className="absolute"
          style={{ right: "2.5%", top: "1.5%", width: "8%", aspectRatio: "1/1", borderRadius: "50%" }}
          aria-label="Settings"
        />

        {/* CENTER TIMER (inside the empty golden badge) */}
        <div
          className="absolute flex items-center justify-center font-black"
          style={{
            left: "50%", top: "23%", transform: "translate(-50%, -50%) rotateX(7deg)",
            width: "22%", aspectRatio: "1/1",
            borderRadius: "50%",
            color: "hsl(50 95% 75%)",
            fontSize: "min(13vw, 64px)",
            lineHeight: 1,
            textShadow: "0 0 14px hsla(45,95%,70%,0.95), 0 3px 0 hsla(0,0%,0%,0.75)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          {phase === "dealing" ? "…" : phase === "result" ? resultTimer : betTimer}
        </div>

        {/* DRAGON & TIGER CARDS — fit exactly inside painted card-back frames */}
        <div
          className="absolute rounded-md"
          style={{
            left: "27.2%", top: "29.6%", width: "13.8%", aspectRatio: "3/5.1",
            boxShadow: "0 0 14px 3px hsla(210, 100%, 60%, 0.95), 0 0 36px 8px hsla(210, 100%, 55%, 0.75), inset 0 0 12px hsla(210, 100%, 70%, 0.6)",
            animation: "dt-glow-blue 1.6s ease-in-out infinite",
          }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-md">{renderCard(dragonCard)}</div>
        </div>
        <div
          className="absolute rounded-md"
          style={{
            left: "59.4%", top: "29.6%", width: "13.8%", aspectRatio: "3/5.1",
            boxShadow: "0 0 14px 3px hsla(20, 100%, 55%, 0.95), 0 0 36px 8px hsla(15, 100%, 50%, 0.8), inset 0 0 12px hsla(30, 100%, 65%, 0.6)",
            animation: "dt-glow-red 1.6s ease-in-out infinite",
          }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-md">{renderCard(tigerCard)}</div>
        </div>
        <style>{`
          @keyframes dt-glow-blue {
            0%, 100% { box-shadow: 0 0 14px 3px hsla(210,100%,60%,0.95), 0 0 36px 8px hsla(210,100%,55%,0.75), inset 0 0 12px hsla(210,100%,70%,0.6); }
            50% { box-shadow: 0 0 22px 6px hsla(210,100%,65%,1), 0 0 60px 14px hsla(210,100%,55%,0.95), inset 0 0 18px hsla(210,100%,75%,0.8); }
          }
          @keyframes dt-glow-red {
            0%, 100% { box-shadow: 0 0 14px 3px hsla(20,100%,55%,0.95), 0 0 36px 8px hsla(15,100%,50%,0.8), inset 0 0 12px hsla(30,100%,65%,0.6); }
            50% { box-shadow: 0 0 22px 6px hsla(20,100%,60%,1), 0 0 60px 14px hsla(10,100%,50%,1), inset 0 0 18px hsla(30,100%,70%,0.85); }
          }
          @keyframes dt-fire-breath-r {
            0%   { transform: translateY(-50%) scaleX(0.15) scaleY(0.4); opacity: 0; filter: blur(6px) hue-rotate(0deg); }
            15%  { transform: translateY(-50%) scaleX(0.55) scaleY(0.85); opacity: 1; filter: blur(2px) hue-rotate(-5deg); }
            55%  { transform: translateY(-50%) scaleX(1.05) scaleY(1.15); opacity: 1; filter: blur(1px) hue-rotate(8deg); }
            100% { transform: translateY(-50%) scaleX(1.25) scaleY(0.55); opacity: 0; filter: blur(4px) hue-rotate(15deg); }
          }
          @keyframes dt-fire-breath-l {
            0%   { transform: translateY(-50%) scaleX(-0.15) scaleY(0.4); opacity: 0; filter: blur(6px) hue-rotate(0deg); }
            15%  { transform: translateY(-50%) scaleX(-0.55) scaleY(0.85); opacity: 1; filter: blur(2px) hue-rotate(-5deg); }
            55%  { transform: translateY(-50%) scaleX(-1.05) scaleY(1.15); opacity: 1; filter: blur(1px) hue-rotate(8deg); }
            100% { transform: translateY(-50%) scaleX(-1.25) scaleY(0.55); opacity: 0; filter: blur(4px) hue-rotate(15deg); }
          }
          @keyframes dt-ember {
            0%   { transform: translate(0,0) scale(1); opacity: 1; }
            100% { transform: translate(var(--ex,0px), var(--ey,-40px)) scale(0.2); opacity: 0; }
          }
          @keyframes dt-flicker {
            0%, 100% { opacity: 0.95; filter: brightness(1.05); }
            50%      { opacity: 0.7;  filter: brightness(1.4); }
          }
          @keyframes dt-shockwave {
            0%   { transform: translate(-50%,-50%) scale(0.2); opacity: 0.9; }
            100% { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
          }
          @keyframes dt-screen-flash {
            0%   { opacity: 0; }
            20%  { opacity: 0.85; }
            100% { opacity: 0; }
          }
          @keyframes dt-win-title-shine {
            0% { background-position: 0% 50%; transform: translate(-50%, -50%) scale(0.9) rotateX(16deg); }
            45% { background-position: 100% 50%; transform: translate(-50%, -50%) scale(1.08) rotateX(0deg); }
            100% { background-position: 0% 50%; transform: translate(-50%, -50%) scale(1) rotateX(0deg); }
          }
          @keyframes dt-win-coin-burst {
            0% { transform: translate(-50%, -50%) rotate(var(--r, 0deg)) translateY(0) scale(0.3); opacity: 0; }
            18% { opacity: 1; }
            100% { transform: translate(-50%, -50%) rotate(var(--r, 0deg)) translateY(var(--d, -120px)) scale(1); opacity: 0; }
          }
        `}</style>

        {/* WIN VIDEO EFFECT OVERLAY ON BOWL PANELS — clipped to bowl-half shape */}
        <AnimatePresence>
          {phase === "result" && winner === "dragon" && (
            <motion.div
              key={`dragon-win-video-${winEffectKey}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute pointer-events-none"
              style={{
                left: "9.7%", top: "46.2%", width: "40.8%", height: "35.6%",
                zIndex: 7,
                clipPath: "polygon(9% 49%, 12% 31%, 22% 14%, 41% 4%, 75% 0, 100% 24%, 100% 100%, 44% 100%, 21% 89%, 9% 72%)",
                WebkitClipPath: "polygon(9% 49%, 12% 31%, 22% 14%, 41% 4%, 75% 0, 100% 24%, 100% 100%, 44% 100%, 21% 89%, 9% 72%)",
                filter: "drop-shadow(0 0 22px hsla(210,100%,60%,0.85))",
              }}
            >
              <video
                src={DRAGON_WIN_EFFECT_SRC}
                autoPlay loop muted playsInline preload="auto"
                ref={replayWinVideo}
                className="absolute w-full h-full object-contain"
                style={{ left: "-5%", top: "6%", width: "94%", height: "78%", mixBlendMode: "screen", filter: "saturate(1.45) brightness(1.12)" }}
              />
              <div className="absolute inset-0" style={{
                background: "radial-gradient(ellipse 70% 55% at 50% 56%, hsla(210,100%,55%,0.24), transparent 72%)",
                mixBlendMode: "screen",
              }} />
            </motion.div>
          )}
          {phase === "result" && winner === "tiger" && (
            <motion.div
              key={`tiger-win-video-${winEffectKey}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute pointer-events-none"
              style={{
                left: "49.5%", top: "46.2%", width: "40.8%", height: "35.6%",
                zIndex: 7,
                clipPath: "polygon(0 24%, 25% 0, 59% 4%, 78% 14%, 88% 31%, 91% 49%, 91% 72%, 79% 89%, 56% 100%, 0 100%)",
                WebkitClipPath: "polygon(0 24%, 25% 0, 59% 4%, 78% 14%, 88% 31%, 91% 49%, 91% 72%, 79% 89%, 56% 100%, 0 100%)",
                filter: "drop-shadow(0 0 22px hsla(20,100%,55%,0.85))",
              }}
            >
              <video
                src={TIGER_WIN_EFFECT_SRC}
                autoPlay loop muted playsInline preload="auto"
                ref={replayWinVideo}
                className="absolute w-full h-full object-contain"
                style={{ right: "-5%", top: "6%", width: "94%", height: "78%", mixBlendMode: "screen", filter: "saturate(1.45) brightness(1.12)" }}
              />
              <div className="absolute inset-0" style={{
                background: "radial-gradient(ellipse 70% 55% at 50% 56%, hsla(20,100%,55%,0.24), transparent 72%)",
                mixBlendMode: "screen",
              }} />
            </motion.div>
          )}
          {phase === "result" && winner === "tie" && (
            <motion.div
              key={`tie-win-video-${winEffectKey}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute pointer-events-none"
              style={{
                left: "29%", top: "40.7%", width: "42%", height: "12%",
                zIndex: 7,
                clipPath: "ellipse(50% 100% at 50% 100%)",
                WebkitClipPath: "ellipse(50% 100% at 50% 100%)",
                filter: "drop-shadow(0 0 18px hsla(140,80%,55%,0.85))",
              }}
            >
              <video
                src={TIGER_WIN_EFFECT_SRC}
                autoPlay loop muted playsInline preload="auto"
                ref={replayWinVideo}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ mixBlendMode: "screen", filter: "hue-rotate(90deg) saturate(1.5) brightness(1.1)" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* HISTORY ROW — overlay D/T markers (10 slots) */}
        <div
          className="absolute flex items-center justify-between"
          style={{ left: "17%", right: "19%", top: "42.6%", height: "3.3%", zIndex: 8 }}
        >
          {history.map((h, i) => (
            <div
              key={i}
              className="rounded-full flex items-center justify-center font-black text-white"
              style={{
                width: "8%", aspectRatio: "1/1",
                fontSize: "min(2.6vw, 12px)",
                background: h === "dragon"
                  ? "radial-gradient(circle at 30% 30%, hsl(220 90% 60%), hsl(220 90% 35%))"
                  : h === "tiger"
                  ? "radial-gradient(circle at 30% 30%, hsl(28 95% 60%), hsl(20 90% 38%))"
                  : "radial-gradient(circle at 30% 30%, hsl(140 80% 55%), hsl(140 80% 35%))",
                boxShadow: "inset 0 1px 1px hsla(0,0%,100%,0.4), 0 1px 2px hsla(0,0%,0%,0.5)",
                opacity: 0,
              }}
            >
              {h === "dragon" ? "D" : h === "tiger" ? "T" : "T"}
            </div>
          ))}
        </div>

        {/* TIE PANEL (top arc) */}
        <button
          onClick={() => addBet("tie")}
          disabled={phase !== "betting"}
          className="absolute overflow-visible"
          style={{ left: "28.7%", top: "47.1%", width: "42.6%", height: "11.2%", borderRadius: "50% 50% 0 0", zIndex: 12, WebkitTapHighlightColor: "transparent" }}
        >
          {renderPlacedBet("tie", bets.tie)}
          {phase === "betting" && betFeedback?.side === "tie" && (
            <motion.div
              key={`tie-${betFeedback.key}`}
              initial={{ scale: 0.75, opacity: 0.9 }}
              animate={{ scale: 1.08, opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="absolute inset-0 rounded-t-full pointer-events-none"
              style={{ boxShadow: betFeedback.kind === "success" ? "inset 0 0 0 4px hsl(140 90% 55%), 0 0 28px hsl(140 90% 55%)" : "inset 0 0 0 4px hsl(0 85% 60%), 0 0 28px hsl(0 85% 60%)" }}
            />
          )}
          {phase === "result" && winner === "tie" && (
            <div className="absolute inset-0 rounded-t-full" style={{ boxShadow: "inset 0 0 0 3px hsl(140 80% 55%), 0 0 25px hsl(140 80% 55%)" }} />
          )}
        </button>

        {/* DRAGON PANEL (left half of bowl) */}
        <button
          onClick={() => addBet("dragon")}
          disabled={phase !== "betting"}
          className="absolute overflow-visible"
          style={{ left: "9.5%", top: "56.4%", width: "40.8%", height: "28.8%", zIndex: 12, WebkitTapHighlightColor: "transparent", borderRadius: "0 0 0 55%" }}
        >
          {renderPlacedBet("dragon", bets.dragon)}
          {phase === "betting" && betFeedback?.side === "dragon" && (
            <motion.div
              key={`dragon-${betFeedback.key}`}
              initial={{ scale: 0.9, opacity: 0.9 }}
              animate={{ scale: 1.04, opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="absolute inset-0 rounded-l-full pointer-events-none"
              style={{ boxShadow: betFeedback.kind === "success" ? "inset 0 0 0 5px hsl(140 90% 55%), 0 0 30px hsl(140 90% 55%)" : "inset 0 0 0 5px hsl(0 85% 60%), 0 0 30px hsl(0 85% 60%)" }}
            />
          )}
        </button>

        {/* TIGER PANEL (right half of bowl) */}
        <button
          onClick={() => addBet("tiger")}
          disabled={phase !== "betting"}
          className="absolute overflow-visible"
          style={{ left: "49.6%", top: "56.4%", width: "40.8%", height: "28.8%", zIndex: 12, WebkitTapHighlightColor: "transparent", borderRadius: "0 0 55% 0" }}
        >
          {renderPlacedBet("tiger", bets.tiger)}
          {phase === "betting" && betFeedback?.side === "tiger" && (
            <motion.div
              key={`tiger-${betFeedback.key}`}
              initial={{ scale: 0.9, opacity: 0.9 }}
              animate={{ scale: 1.04, opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="absolute inset-0 rounded-r-full pointer-events-none"
              style={{ boxShadow: betFeedback.kind === "success" ? "inset 0 0 0 5px hsl(140 90% 55%), 0 0 30px hsl(140 90% 55%)" : "inset 0 0 0 5px hsl(0 85% 60%), 0 0 30px hsl(0 85% 60%)" }}
            />
          )}
        </button>

        <button
          onClick={() => { if (phase === "betting" && totalBet === 0) setActiveWallet((w) => w === "dollar" ? "star" : "dollar"); }}
          className="absolute flex flex-col items-center justify-center font-black text-white"
          style={{
            left: "2%", top: "84.4%", width: "10%", aspectRatio: "1/1.4",
            background: "transparent",
            zIndex: 6,
          }}
        >
          <span style={{ fontSize: "min(2.4vw, 11px)", color: "hsl(50 90% 70%)", textShadow: "0 1px 0 hsla(0,0%,0%,0.7)" }}>
            {sym}{currentBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </button>

        {/* CHIP SELECTOR ROW — invisible hit targets over painted 3D chips */}
        <div
          className="absolute"
          style={{
            left: "0%",
            right: "0%",
            top: "81.9%",
            height: "10%",
            zIndex: 20,
            pointerEvents: "auto",
            overflow: "visible",
          }}
        >
          {CHIP_VALUES.map((v, index) => {
            const isActive = chip === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => selectChip(v)}
                className="absolute rounded-full touch-manipulation"
                style={{
                  left: `${CHIP_HIT_POSITIONS[index]}%`,
                  top: "53%",
                  width: "12.8%",
                  aspectRatio: "1/1",
                  backgroundImage: isActive ? `url(${CHIP_IMAGES[index]})` : "none",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  backgroundSize: "contain",
                  border: 0,
                  padding: 0,
                  transform: `translate(-50%, -50%) scale(${isActive ? 1.5 : 1}) translateZ(${isActive ? 28 : 0}px)`,
                  transformOrigin: "center",
                  transition: "transform 180ms cubic-bezier(0.34,1.56,0.64,1)",
                  cursor: phase === "betting" ? "pointer" : "default",
                  zIndex: 28,
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                  overflow: "visible",
                  filter: isActive ? "drop-shadow(0 10px 10px hsla(0, 0%, 0%, 0.55))" : "none",
                }}
                aria-label={`Chip ${v}`}
                aria-pressed={isActive}
                disabled={phase !== "betting"}
              />
            );
          })}
        </div>

        {/* BOTTOM BAR — repeat avatar / total / + (deal) / settings */}
        <button
          onClick={repeatBets}
          className="absolute"
          style={{ left: "9%", top: "92.8%", width: "9%", aspectRatio: "1/1", borderRadius: "50%", zIndex: 18 }}
          aria-label="Repeat last bet"
        />
        <div
          className="absolute flex items-center justify-center font-black text-white"
          style={{ left: "20%", right: "32%", top: "92.9%", height: "4.2%", fontSize: "min(4.4vw, 22px)", color: "hsl(45 95% 70%)", textShadow: "0 1px 0 hsl(0 0% 0% / 0.8), 0 0 12px hsl(45 100% 55% / 0.45)", zIndex: 18 }}
        >
          {betStatus || (totalBet > 0 ? totalBet.toFixed(2) : phase === "betting" ? `${sym}${chip}` : "0.00")}
        </div>
        <button
          onClick={deal}
          disabled={phase !== "betting" || totalBet === 0 || currentBalance < totalBet}
          className="absolute"
          style={{ right: "16%", top: "92.8%", width: "8%", aspectRatio: "1/1", borderRadius: "50%", zIndex: 18 }}
          aria-label="Deal"
        >
          <AnimatePresence>
            {phase === "betting" && totalBet > 0 && (
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: "0 0 0 3px hsl(140 80% 50%), 0 0 22px hsl(140 80% 50%)" }}
              />
            )}
          </AnimatePresence>
        </button>
        <button
          onClick={doubleAllBets}
          disabled={phase !== "betting" || totalBet === 0 || currentBalance < totalBet * 2}
          className="absolute"
          style={{ right: "4%", top: "92.8%", width: "8%", aspectRatio: "1/1", borderRadius: "50%", zIndex: 18 }}
          aria-label="Double bet"
        >
          {phase === "betting" && totalBet > 0 && currentBalance >= totalBet * 2 && (
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ boxShadow: "0 0 0 3px hsl(140 80% 50%), 0 0 18px hsla(140,80%,50%,0.9)" }}
            />
          )}
        </button>

        {/* RESULT MESSAGE + 3D WIN ANIMATION */}
        <AnimatePresence>
          {phase === "result" && winner && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: 30, perspective: "1000px" }}
            >
              {winAmount > 0 && Array.from({ length: 16 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    left: "50%",
                    top: "52%",
                    width: "min(3.2vw, 16px)",
                    aspectRatio: "1/1",
                    background: "radial-gradient(circle at 35% 28%, hsl(53 100% 82%), hsl(38 96% 50%) 52%, hsl(28 88% 34%))",
                    boxShadow: "inset 0 1px 1px hsl(0 0% 100% / 0.65), 0 0 10px hsl(43 100% 55% / 0.8)",
                    animation: `dt-win-coin-burst ${900 + (i % 4) * 140}ms ease-out ${i * 34}ms both`,
                    ["--r" as string]: `${i * 22.5}deg`,
                    ["--d" as string]: `${90 + (i % 5) * 22}px`,
                  }}
                />
              ))}
              <motion.div
                initial={{ scale: 0.55, rotateX: 55, y: 28 }}
                animate={{ scale: 1, rotateX: 0, y: 0 }}
                exit={{ scale: 0.75, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="absolute left-1/2 top-1/2 flex flex-col items-center justify-center text-center font-game"
                style={{
                  width: "76%",
                  minHeight: "13%",
                  transformStyle: "preserve-3d",
                  transform: "translate(-50%, -50%)",
                  borderRadius: "20px",
                  background: "linear-gradient(180deg, hsl(42 85% 20% / 0.92), hsl(20 85% 8% / 0.95))",
                  border: "2px solid hsl(45 95% 62% / 0.9)",
                  boxShadow: "inset 0 2px 1px hsl(52 100% 82% / 0.45), inset 0 -6px 18px hsl(0 0% 0% / 0.45), 0 18px 38px hsl(0 0% 0% / 0.75), 0 0 36px hsl(43 100% 55% / 0.65)",
                }}
              >
                <div
                  className="absolute inset-0 rounded-[18px]"
                  style={{ background: "linear-gradient(120deg, transparent 20%, hsl(52 100% 78% / 0.22), transparent 80%)" }}
                />
                <div
                  className="relative font-black uppercase"
                  style={{
                    fontSize: "min(10vw, 56px)",
                    lineHeight: 0.95,
                    letterSpacing: 0,
                    color: "transparent",
                    background: winAmount > 0
                      ? "linear-gradient(90deg, hsl(39 90% 45%), hsl(54 100% 78%), hsl(32 95% 52%), hsl(54 100% 78%))"
                      : "linear-gradient(90deg, hsl(0 80% 58%), hsl(28 90% 70%), hsl(0 80% 58%))",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    backgroundSize: "260% 100%",
                    animation: "dt-win-title-shine 1.15s ease-out both",
                    textShadow: "0 5px 0 hsl(24 100% 12% / 0.75), 0 0 24px hsl(45 100% 58% / 0.65)",
                  }}
                >
                  {winAmount > 0 ? "WIN" : "LOSE"}
                </div>
                <div
                  className="relative font-black uppercase"
                  style={{
                    marginTop: 4,
                    fontSize: "min(4.2vw, 22px)",
                    color: winner === "dragon" ? "hsl(205 100% 72%)" : winner === "tiger" ? "hsl(27 100% 70%)" : "hsl(130 90% 68%)",
                    textShadow: "0 2px 0 hsl(0 0% 0% / 0.8), 0 0 14px currentColor",
                  }}
                >
                  {winner === "tie" ? "TIE 8:1" : `${winner} wins`}
                </div>
                <div
                  className="relative font-black"
                  style={{
                    marginTop: 2,
                    fontSize: "min(5.2vw, 28px)",
                    color: winAmount > 0 ? "hsl(50 96% 72%)" : "hsl(0 78% 72%)",
                    textShadow: "0 2px 0 hsl(0 0% 0% / 0.75)",
                  }}
                >
                  {winAmount > 0 ? `+${sym}${winAmount}` : "Better luck"}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default DragonTigerGame;
