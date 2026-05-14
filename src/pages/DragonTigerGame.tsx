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
      toast.error(`Insufficient ${activeWallet === "dollar" ? "$" : "⭐"} balance — please deposit`);
      return;
    }
    setBets((p) => ({ ...p, [side]: p[side] + chip }));
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
        {/* 3D TABLE BACKGROUND with perspective tilt + ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ perspective: "1400px", perspectiveOrigin: "50% 30%" }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: "rotateX(8deg) translateZ(0)",
              transformStyle: "preserve-3d",
              transformOrigin: "50% 40%",
              filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.75)) drop-shadow(0 0 60px rgba(255,170,40,0.18))",
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
                  "radial-gradient(ellipse 70% 35% at 50% 18%, hsla(45,95%,70%,0.18), transparent 70%), radial-gradient(ellipse 90% 55% at 50% 95%, hsla(0,0%,0%,0.55), transparent 60%)",
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
            left: "50%", top: "24%", transform: "translate(-50%, -50%)",
            width: "20%", aspectRatio: "1/1",
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
            left: "25.5%", top: "31.3%", width: "15%", aspectRatio: "3/5.1",
            boxShadow: "0 0 14px 3px hsla(210, 100%, 60%, 0.95), 0 0 36px 8px hsla(210, 100%, 55%, 0.75), inset 0 0 12px hsla(210, 100%, 70%, 0.6)",
            animation: "dt-glow-blue 1.6s ease-in-out infinite",
          }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-md">{renderCard(dragonCard)}</div>
        </div>
        <div
          className="absolute rounded-md"
          style={{
            left: "60.5%", top: "31.3%", width: "15%", aspectRatio: "3/5.1",
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
                left: "10.7%", top: "48.1%", width: "39.6%", height: "33.6%",
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
                left: "49.7%", top: "48.1%", width: "39.6%", height: "33.6%",
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
                left: "30%", top: "39%", width: "40%", height: "11%",
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
          style={{ left: "16%", right: "20%", top: "47%", height: "3%" }}
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
          className="absolute"
          style={{ left: "30%", top: "37%", width: "40%", height: "12%", borderRadius: "50% 50% 0 0" }}
        >
          {bets.tie > 0 && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full font-black"
              style={{ background: "linear-gradient(135deg, hsl(45 95% 60%), hsl(25 90% 50%))", color: "hsl(0 0% 12%)", fontSize: "min(2.8vw, 13px)" }}>
              {sym}{bets.tie}
            </div>
          )}
          {phase === "result" && winner === "tie" && (
            <div className="absolute inset-0 rounded-t-full" style={{ boxShadow: "inset 0 0 0 3px hsl(140 80% 55%), 0 0 25px hsl(140 80% 55%)" }} />
          )}
        </button>

        {/* DRAGON PANEL (left half of bowl) */}
        <button
          onClick={() => addBet("dragon")}
          disabled={phase !== "betting"}
          className="absolute"
          style={{ left: "13%", top: "49%", width: "37%", height: "32%" }}
        >
          {bets.dragon > 0 && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full font-black"
              style={{ background: "linear-gradient(135deg, hsl(45 95% 60%), hsl(25 90% 50%))", color: "hsl(0 0% 12%)", fontSize: "min(2.8vw, 13px)", boxShadow: "0 2px 8px hsla(0,0%,0%,0.6)" }}>
              {sym}{bets.dragon}
            </div>
          )}
        </button>

        {/* TIGER PANEL (right half of bowl) */}
        <button
          onClick={() => addBet("tiger")}
          disabled={phase !== "betting"}
          className="absolute"
          style={{ left: "50%", top: "49%", width: "37%", height: "32%" }}
        >
          {bets.tiger > 0 && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full font-black"
              style={{ background: "linear-gradient(135deg, hsl(45 95% 60%), hsl(25 90% 50%))", color: "hsl(0 0% 12%)", fontSize: "min(2.8vw, 13px)", boxShadow: "0 2px 8px hsla(0,0%,0%,0.6)" }}>
              {sym}{bets.tiger}
            </div>
          )}
        </button>

        <button
          onClick={() => { if (phase === "betting" && totalBet === 0) setActiveWallet((w) => w === "dollar" ? "star" : "dollar"); }}
          className="absolute flex flex-col items-center justify-center font-black text-white"
          style={{
            left: "2%", top: "82%", width: "10%", aspectRatio: "1/1.4",
            background: "transparent",
            zIndex: 6,
          }}
        >
          <span style={{ fontSize: "min(2.4vw, 11px)", color: "hsl(50 90% 70%)", textShadow: "0 1px 0 hsla(0,0%,0%,0.7)" }}>
            {sym}{currentBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </button>

        {/* CHIP SELECTOR ROW — over painted golden chip rack */}
        <div className="absolute flex items-center justify-between" style={{ left: "10%", right: "10%", top: "84%", height: "7.5%" }}>
          {CHIP_VALUES.map((v) => {
            const isActive = chip === v;
            return (
              <button
                key={v}
                onClick={() => {
                  if (phase !== "betting") {
                    toast.error("Round in progress, wait for next round");
                    return;
                  }
                  setChip(v);
                }}
                className="relative rounded-full transition-transform"
                style={{
                  width: "15%",
                  aspectRatio: "1/1",
                  background: "transparent",
                  transform: isActive ? "translateY(-8%) scale(1.08)" : "none",
                  filter: isActive ? "drop-shadow(0 0 12px hsla(45,95%,60%,0.95))" : "none",
                }}
                aria-label={`Chip ${v}`}
              />
            );
          })}
        </div>

        {/* BOTTOM BAR — repeat avatar / total / + (deal) / settings */}
        <button
          onClick={repeatBets}
          className="absolute"
          style={{ left: "9%", top: "96%", width: "9%", aspectRatio: "1/1", borderRadius: "50%" }}
          aria-label="Repeat last bet"
        />
        <div
          className="absolute flex items-center justify-center font-black text-white"
          style={{ left: "20%", right: "32%", top: "96.4%", height: "3.5%", fontSize: "min(4vw, 18px)", color: "hsl(45 95% 70%)", textShadow: "0 1px 0 hsla(0,0%,0%,0.6)" }}
        >
          {totalBet.toFixed(2)}
        </div>
        <button
          onClick={deal}
          disabled={phase !== "betting" || totalBet === 0 || currentBalance < totalBet}
          className="absolute"
          style={{ right: "16%", top: "96%", width: "8%", aspectRatio: "1/1", borderRadius: "50%" }}
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
          style={{ right: "4%", top: "96%", width: "8%", aspectRatio: "1/1", borderRadius: "50%" }}
          aria-label="Double bet"
        >
          {phase === "betting" && totalBet > 0 && currentBalance >= totalBet * 2 && (
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ boxShadow: "0 0 0 3px hsl(140 80% 50%), 0 0 18px hsla(140,80%,50%,0.9)" }}
            />
          )}
        </button>

        {/* RESULT MESSAGE FLOATING */}
        <AnimatePresence>
          {phase === "result" && winner && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full"
              style={{
                top: "33%",
                background: "hsla(220,30%,5%,0.92)",
                border: "1.5px solid hsla(45,90%,55%,0.7)",
                zIndex: 10,
              }}
            >
              {winAmount > 0 ? (
                <p className="font-black whitespace-nowrap" style={{ color: "hsl(50 95% 70%)", fontSize: "min(3vw, 14px)" }}>
                  🎉 {winner === "tie" ? "TIE!" : winner.toUpperCase() + " WINS"} +{sym}{winAmount}
                </p>
              ) : (
                <p className="font-black whitespace-nowrap" style={{ color: "hsl(0 80% 70%)", fontSize: "min(3vw, 14px)" }}>
                  💨 {winner.toUpperCase()} — Better luck next round
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DragonTigerGame;
