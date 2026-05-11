import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Maximize2, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import chickenImg from "@/assets/chickenroad/chicken.png";
import manholeImg from "@/assets/chickenroad/manhole.png";
import signboardImg from "@/assets/chickenroad/signboard.png";
import truckImg from "@/assets/chickenroad/truck.png";
import carImg from "@/assets/chickenroad/car.png";
import barrierImg from "@/assets/chickenroad/barrier.png";
import logoImg from "@/assets/chickenroad/logo.png";
import asphaltImg from "@/assets/chickenroad/asphalt.jpg";
import {
  playBetSound,
  playWinSound,
  playLoseSound,
  playResultReveal,
  startBgMusic,
  stopBgMusic,
} from "@/hooks/useGameSounds";
import { useBalanceContext } from "@/contexts/BalanceContext";
import { reportGameResult } from "@/lib/telegram";
import { toast } from "@/hooks/use-toast";

type Difficulty = "easy" | "medium" | "hard" | "hardcore";
type Phase = "betting" | "playing" | "lost" | "cashed";

const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { multipliers: number[]; crashBase: number; label: string; color: string; ring: string }
> = {
  easy: {
    multipliers: [1.03, 1.07, 1.12, 1.17, 1.24, 1.33, 1.44, 1.58, 1.75, 1.96, 2.23, 2.55, 2.96, 3.48, 4.13, 4.97, 6.03, 7.42, 9.22, 11.60, 14.76, 19.00],
    crashBase: 0.05,
    label: "Easy",
    color: "hsl(140 75% 50%)",
    ring: "hsl(140 90% 65%)",
  },
  medium: {
    multipliers: [1.12, 1.28, 1.46, 1.67, 2.64, 5.81, 17.79, 75.65, 447, 1700],
    crashBase: 0.18,
    label: "Medium",
    color: "hsl(210 90% 55%)",
    ring: "hsl(210 95% 70%)",
  },
  hard: {
    multipliers: [1.23, 1.55, 1.97, 2.50, 4.33, 10.21, 32.75, 143.0, 850.4, 6885, 40899],
    crashBase: 0.28,
    label: "Hard",
    color: "hsl(28 95% 55%)",
    ring: "hsl(28 100% 68%)",
  },
  hardcore: {
    multipliers: [1.61, 2.77, 4.90, 8.67, 25.01, 117.7, 903.6, 11314, 231066, 2516310],
    crashBase: 0.45,
    label: "Hardcore",
    color: "hsl(0 85% 55%)",
    ring: "hsl(0 95% 68%)",
  },
};

const BET_PRESETS = [0.5, 1, 2, 7];

const ChickenRoadGame = () => {
  const navigate = useNavigate();
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);
  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  const { dollarBalance, starBalance, dollarWinning, starWinning, refreshBalance } =
    useBalanceContext();
  const [localDollarAdj, setLocalDollarAdj] = useState(0);
  const [localStarAdj, setLocalStarAdj] = useState(0);
  const gameDollarBalance = dollarBalance + dollarWinning + localDollarAdj;
  const gameStarBalance = starBalance + starWinning + localStarAdj;

  const [activeWallet, setActiveWallet] = useState<"dollar" | "star">("dollar");
  const [selectedBet, setSelectedBet] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [phase, setPhase] = useState<Phase>("betting");
  const [currentLane, setCurrentLane] = useState(0);
  const [carLane, setCarLane] = useState<number | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  useEffect(() => {
    if (soundOn) startBgMusic();
    else stopBgMusic();
    return () => stopBgMusic();
  }, [soundOn]);

  const cfg = DIFFICULTY_CONFIG[difficulty];
  const currentBalance = activeWallet === "dollar" ? gameDollarBalance : gameStarBalance;
  const currentMultiplier = currentLane > 0 ? cfg.multipliers[currentLane - 1] : 0;
  const nextMultiplier =
    currentLane < cfg.multipliers.length ? cfg.multipliers[currentLane] : cfg.multipliers[cfg.multipliers.length - 1];

  const startGame = useCallback(() => {
    if (currentBalance < selectedBet) {
      toast({
        title: "Insufficient balance",
        description: `Need ${activeWallet === "dollar" ? "$" : ""}${selectedBet}${
          activeWallet === "star" ? " ⭐" : ""
        } to play`,
        variant: "destructive",
      });
      return;
    }
    if (activeWallet === "dollar") setLocalDollarAdj((p) => p - selectedBet);
    else setLocalStarAdj((p) => p - selectedBet);
    if (soundRef.current) playBetSound();

    setCurrentLane(0);
    setCarLane(null);
    setWinAmount(0);
    setPhase("playing");
  }, [currentBalance, selectedBet, activeWallet]);

  const goNext = useCallback(() => {
    if (phase === "betting") {
      startGame();
      return;
    }
    if (phase !== "playing") return;
    if (currentLane >= cfg.multipliers.length) return;

    const stepIndex = currentLane;
    const earlyBoost = stepIndex < 2 ? 1.25 : 1.0;
    const lateScale = stepIndex >= cfg.multipliers.length - 2 ? 1.4 : 1.0;
    const hitProb = Math.min(0.9, cfg.crashBase * earlyBoost * lateScale);
    const isHit = Math.random() < hitProb;

    if (isHit) {
      setCarLane(stepIndex + 1);
      setPhase("lost");
      if (soundRef.current) playLoseSound();
      reportGameResult({
        betAmount: selectedBet,
        winAmount: 0,
        currency: activeWallet,
        game: "chickenroad",
      })
        .then(() => {
          setLocalDollarAdj(0);
          setLocalStarAdj(0);
          refreshBalance();
        })
        .catch(console.error);
      return;
    }

    const newLane = currentLane + 1;
    setCurrentLane(newLane);
    if (soundRef.current) playResultReveal();

    if (newLane >= cfg.multipliers.length) {
      const mult = cfg.multipliers[cfg.multipliers.length - 1];
      const prize = Math.floor(selectedBet * mult * 100) / 100;
      setWinAmount(prize);
      setPhase("cashed");
      if (soundRef.current) playWinSound();
      reportGameResult({
        betAmount: selectedBet,
        winAmount: prize,
        currency: activeWallet,
        game: "chickenroad",
      })
        .then(() => {
          setLocalDollarAdj(0);
          setLocalStarAdj(0);
          refreshBalance();
        })
        .catch(console.error);
    }
  }, [phase, currentLane, cfg, selectedBet, activeWallet, refreshBalance, startGame]);

  const cashOut = useCallback(() => {
    if (phase !== "playing" || currentLane === 0) return;
    const mult = cfg.multipliers[currentLane - 1];
    const prize = Math.floor(selectedBet * mult * 100) / 100;
    setWinAmount(prize);
    setPhase("cashed");
    if (soundRef.current) playWinSound();
    reportGameResult({
      betAmount: selectedBet,
      winAmount: prize,
      currency: activeWallet,
      game: "chickenroad",
    })
      .then(() => {
        setLocalDollarAdj(0);
        setLocalStarAdj(0);
        refreshBalance();
      })
      .catch(console.error);
  }, [phase, currentLane, cfg, selectedBet, activeWallet, refreshBalance]);

  const resetToBet = () => {
    setPhase("betting");
    setCurrentLane(0);
    setCarLane(null);
    setWinAmount(0);
  };

  const fmt = (n: number) =>
    activeWallet === "dollar" ? `${n.toFixed(2)} $` : `${n.toFixed(2)} ⭐`;
  const potentialWin = currentLane > 0 ? selectedBet * currentMultiplier : selectedBet * nextMultiplier;

  // Show 6 lanes window centered around chicken (chicken always visible at left)
  const visibleStart = Math.max(0, Math.min(currentLane - 1, cfg.multipliers.length - 6));
  const visibleLanes = cfg.multipliers.slice(visibleStart, visibleStart + 6);

  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{
        background: "linear-gradient(180deg, #0a0a0f 0%, #050507 100%)",
      }}
    >
      {/* ============ TOP BAR ============ */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5" style={{ background: "#0a0a0f" }}>
        {/* Logo */}
        <button onClick={() => navigate("/")} className="shrink-0 active:scale-95 transition-transform">
          <img
            src={logoImg}
            alt="Chicken Road"
            className="h-11 w-auto"
            style={{ filter: "drop-shadow(0 0 8px rgba(255,120,30,0.5))" }}
          />
        </button>

        {/* How to play */}
        <button
          onClick={() => setHowOpen(true)}
          className="flex items-center gap-1.5 px-2.5 h-9 rounded-xl text-[11px] font-semibold whitespace-nowrap"
          style={{
            background: "#15161c",
            border: "1px solid #2a2c36",
            color: "#cfd2dc",
          }}
        >
          <BookOpen className="h-3.5 w-3.5" />
          How to play?
        </button>

        {/* Balance pills: $ and ⭐ */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveWallet("dollar")}
            className="flex items-center gap-1 px-2 h-9 rounded-xl font-bold text-[11px] whitespace-nowrap"
            style={{
              background: "#0e1116",
              border: `1.5px solid ${activeWallet === "dollar" ? "hsl(140 80% 50%)" : "#232735"}`,
              boxShadow: activeWallet === "dollar" ? "0 0 10px hsla(140,80%,50%,0.35)" : "none",
              color: activeWallet === "dollar" ? "#eaf6ea" : "#9aa0ab",
            }}
          >
            💲 {gameDollarBalance.toFixed(2)}
          </button>
          <button
            onClick={() => setActiveWallet("star")}
            className="flex items-center gap-1 px-2 h-9 rounded-xl font-bold text-[11px] whitespace-nowrap"
            style={{
              background: "#0e1116",
              border: `1.5px solid ${activeWallet === "star" ? "hsl(45 90% 55%)" : "#232735"}`,
              boxShadow: activeWallet === "star" ? "0 0 10px hsla(45,90%,55%,0.35)" : "none",
              color: activeWallet === "star" ? "#fff4d6" : "#9aa0ab",
            }}
          >
            ⭐ {gameStarBalance.toLocaleString()}
          </button>
        </div>

        {/* Fullscreen */}
        <button
          onClick={() => {
            const el = document.documentElement;
            if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
            else document.exitFullscreen?.().catch(() => {});
          }}
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#15161c", border: "1px solid #2a2c36", color: "#cfd2dc" }}
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        {/* Menu */}
        <button
          onClick={() => setMenuOpen(true)}
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#15161c", border: "1px solid #2a2c36", color: "#cfd2dc" }}
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* ============ LIVE WINS TICKER ============ */}
      <div
        className="px-3 py-1.5 flex items-center gap-2 overflow-hidden text-[10px] border-y"
        style={{ background: "#07080b", borderColor: "#15171d" }}
      >
        <span className="flex items-center gap-1 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full inline-block animate-pulse" style={{ background: "hsl(140 75% 55%)" }} />
          <span style={{ color: "#9aa0ab" }}>Live wins</span>
        </span>
        <span className="shrink-0" style={{ color: "#3e4250" }}>|</span>
        <span className="shrink-0" style={{ color: "#9aa0ab" }}>
          Online: <span style={{ color: "hsl(140 75% 60%)" }} className="font-bold">33,386</span>
        </span>
        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <motion.div
            animate={{ x: ["100%", "-100%"] }}
            transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
            className="flex gap-5 inline-block"
          >
            {[
              { n: "Blush Comp...", a: "+$160.00" },
              { n: "LuckyMike", a: "+$98.50" },
              { n: "QueenB", a: "+$75.20" },
              { n: "JohnnyX", a: "+$52.00" },
              { n: "MaxPwr", a: "+$230.00" },
            ].map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <span style={{ color: "hsl(45 90% 60%)" }}>⭐</span>
                <span style={{ color: "#cfd2dc" }}>{t.n}</span>
                <span style={{ color: "hsl(140 75% 60%)" }} className="font-bold">{t.a}</span>
                <span style={{ color: "#3e4250" }}>•</span>
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ============ ROAD PLAY AREA ============ */}
      <div className="relative flex-1 overflow-hidden" style={{ background: "#1a1c1e" }}>
        {/* Asphalt texture */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${asphaltImg})`,
            backgroundRepeat: "repeat",
            backgroundSize: "240px 240px",
            filter: "brightness(0.55) saturate(0.6)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.04), transparent 70%), linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        {/* Lanes - vertical strips */}
        <div className="absolute inset-0 flex">
          {/* Sidewalk left */}
          <div
            className="shrink-0 relative"
            style={{
              width: "16%",
              background:
                "linear-gradient(90deg, #1d1f22 0%, #16181b 100%)",
              borderRight: "3px solid rgba(255,255,255,0.12)",
              boxShadow: "inset -8px 0 12px rgba(0,0,0,0.4)",
            }}
          >
            <div className="absolute left-0 right-0 top-[8%] flex flex-col items-center gap-3 px-1">
              {[0, 1].map((i) => (
                <img
                  key={i}
                  src={barrierImg}
                  alt=""
                  className="w-full max-w-[58px] h-auto"
                  style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.7))" }}
                  loading="lazy"
                />
              ))}
            </div>
          </div>

          {/* 6 visible lane strips */}
          {visibleLanes.map((_, i) => (
            <div
              key={i}
              className="flex-1 relative h-full"
              style={{
                borderRight:
                  i < visibleLanes.length - 1
                    ? "0"
                    : "0",
              }}
            >
              {/* Dashed center line */}
              {i < visibleLanes.length - 1 && (
                <div
                  className="absolute top-0 bottom-0"
                  style={{
                    right: 0,
                    width: "3px",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255,255,255,0.85) 50%, transparent 50%)",
                    backgroundSize: "100% 36px",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Lane content overlay */}
        <div className="absolute inset-0 flex">
          {/* Chicken sidewalk */}
          <div
            className="shrink-0 relative"
            style={{ width: "16%" }}
          >
            {currentLane === 0 && phase !== "lost" && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-10 z-20">
                <ChickenOnManhole />
              </div>
            )}
          </div>

          {/* Visible lanes */}
          {visibleLanes.map((mult, i) => {
            const laneNumber = visibleStart + i + 1;
            const isCrossed = currentLane >= laneNumber;
            const isCurrent = currentLane === laneNumber && phase === "playing";
            const isCrashLane = carLane === laneNumber;
            const isNextLane = currentLane === laneNumber - 1 && phase === "playing";
            const isSignLane = i === 0 && currentLane === 0 && phase === "betting";
            const showSignboard = (isNextLane && !isCrossed) || (isSignLane && laneNumber === 1);

            return (
              <div key={laneNumber} className="flex-1 relative h-full">
                {/* Crash truck coming down */}
                <AnimatePresence>
                  {isCrashLane && (
                    <motion.div
                      initial={{ top: "-30%" }}
                      animate={{ top: "55%" }}
                      transition={{ duration: 0.55, ease: "easeIn" }}
                      className="absolute left-1/2 -translate-x-1/2 z-30"
                    >
                      <Truck />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Ambient traffic (decorative loops) — varied per lane */}
                {!isCrashLane && phase !== "lost" && i === 1 && (
                  <motion.div
                    animate={{ top: ["-20%", "90%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.2 }}
                    className="absolute left-1/2 -translate-x-1/2 z-10"
                  >
                    <Car />
                  </motion.div>
                )}
                {!isCrashLane && phase !== "lost" && i === 2 && (
                  <motion.div
                    animate={{ top: ["-25%", "85%"] }}
                    transition={{ duration: 2.0, repeat: Infinity, ease: "linear", delay: 1.0 }}
                    className="absolute left-1/2 -translate-x-1/2 z-10"
                  >
                    <Truck />
                  </motion.div>
                )}
                {!isCrashLane && phase !== "lost" && i === 3 && (
                  <motion.div
                    animate={{ top: ["-30%", "88%"] }}
                    transition={{ duration: 1.7, repeat: Infinity, ease: "linear", delay: 0.6 }}
                    className="absolute left-1/2 -translate-x-1/2 z-10"
                  >
                    <Truck />
                  </motion.div>
                )}
                {!isCrashLane && phase !== "lost" && i === 4 && (
                  <motion.div
                    animate={{ top: ["-15%", "92%"] }}
                    transition={{ duration: 1.3, repeat: Infinity, ease: "linear", delay: 1.4 }}
                    className="absolute left-1/2 -translate-x-1/2 z-10"
                  >
                    <Car />
                  </motion.div>
                )}

                {/* Chicken on this lane (after crossing) */}
                {isCurrent && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-10 z-20">
                    <ChickenOnManhole />
                  </div>
                )}

                {/* Crash splat */}
                {currentLane === laneNumber - 1 && phase === "lost" && carLane === laneNumber && (
                  <motion.div
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: [1, 1.4, 0.8], opacity: [1, 1, 0] }}
                    transition={{ duration: 1 }}
                    className="absolute left-1/2 -translate-x-1/2 bottom-12 text-4xl z-30"
                  >
                    💥
                  </motion.div>
                )}

                {/* Multiplier marker at lane bottom */}
                <div className="absolute left-0 right-0 bottom-10 flex justify-center pointer-events-none">
                  {showSignboard ? (
                    <Signboard value={`${mult.toFixed(2)}x`} />
                  ) : (
                    <ManholeCover
                      label={
                        isCrossed
                          ? "✓"
                          : mult >= 100
                          ? `${mult.toFixed(0)}x`
                          : `${mult.toFixed(2)}x`
                      }
                      crossed={isCrossed}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Status overlay top */}
        <AnimatePresence>
          {phase === "playing" && currentLane > 0 && (
            <motion.div
              key="winbox"
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-black"
              style={{
                background: "linear-gradient(135deg, hsl(140 75% 45%), hsl(150 70% 38%))",
                color: "white",
                boxShadow: "0 0 18px hsla(140,80%,50%,0.55)",
                border: "1.5px solid hsl(140 90% 65%)",
              }}
            >
              {currentMultiplier.toFixed(2)}x · {fmt(selectedBet * currentMultiplier)}
            </motion.div>
          )}
          {phase === "lost" && (
            <motion.div
              key="lostbox"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-black"
              style={{
                background: "linear-gradient(135deg, hsl(0 85% 50%), hsl(15 80% 45%))",
                color: "white",
                boxShadow: "0 0 18px hsla(0,85%,50%,0.6)",
              }}
            >
              💥 SHOT DOWN
            </motion.div>
          )}
          {phase === "cashed" && (
            <motion.div
              key="cashbox"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-black"
              style={{
                background: "linear-gradient(135deg, hsl(45 95% 55%), hsl(28 90% 50%))",
                color: "#1a120a",
                boxShadow: "0 0 18px hsla(45,95%,55%,0.65)",
              }}
            >
              🏆 WON {fmt(winAmount)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ============ BOTTOM CONTROL PANEL ============ */}
      <div className="px-3 pt-3 pb-3 space-y-2" style={{ background: "#0a0b10" }}>
        {/* Row 1: MIN | value | MAX */}
        <div
          className="rounded-2xl p-1.5 flex items-center gap-1.5"
          style={{ background: "#2b2f3d", border: "1px solid #1d2029" }}
        >
          <button
            onClick={() => setSelectedBet(0.5)}
            className="h-12 px-4 rounded-xl text-[13px] font-black"
            style={{ background: "#3a3f50", color: "#eaecf2" }}
          >
            MIN
          </button>
          <div className="flex-1 text-center text-[18px] font-black" style={{ color: "#eaecf2" }}>
            {selectedBet < 1 ? selectedBet.toFixed(2) : selectedBet.toFixed(0)}
          </div>
          <button
            onClick={() => setSelectedBet(Math.max(0.5, Math.floor(currentBalance)))}
            className="h-12 px-4 rounded-xl text-[13px] font-black"
            style={{ background: "#3a3f50", color: "#eaecf2" }}
          >
            MAX
          </button>
        </div>

        {/* Row 2: bet presets */}
        <div className="grid grid-cols-4 gap-1.5">
          {BET_PRESETS.map((bet) => {
            const active = selectedBet === bet;
            return (
              <button
                key={bet}
                onClick={() => setSelectedBet(bet)}
                className="h-14 rounded-2xl text-[15px] font-black flex items-center justify-center gap-1.5"
                style={{
                  background: "#2b2f3d",
                  border: active ? "1.5px solid #ffd84a" : "1px solid #1d2029",
                  color: "#eaecf2",
                  boxShadow: active ? "0 0 10px rgba(255,216,74,0.45)" : "none",
                }}
              >
                {bet}
                <span
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[12px] font-black"
                  style={{
                    background: activeWallet === "dollar" ? "#ffffff" : "#ffd84a",
                    color: "#1a1d26",
                  }}
                >
                  {activeWallet === "dollar" ? "$" : "⭐"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Difficulty pills */}
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => {
            const active = difficulty === d;
            const c = DIFFICULTY_CONFIG[d];
            return (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                disabled={phase === "playing"}
                className="h-12 rounded-2xl text-[13px] font-black"
                style={{
                  background: "#2b2f3d",
                  border: active ? `1.5px solid ${c.ring}` : "1px solid #1d2029",
                  color: active ? c.ring : "#eaecf2",
                  boxShadow: active ? `0 0 10px ${c.color}88` : "none",
                  opacity: phase === "playing" ? 0.5 : 1,
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Row 4: Wallet pills ($ and ⭐) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => phase === "betting" && setActiveWallet("dollar")}
            className="h-12 rounded-2xl flex items-center justify-center gap-2 text-[16px] font-black"
            style={{
              background: "#13161d",
              border: activeWallet === "dollar" ? "2px solid #22e36a" : "2px solid #1d2029",
              color: "#eaecf2",
              boxShadow: activeWallet === "dollar" ? "0 0 12px rgba(34,227,106,0.45)" : "none",
            }}
          >
            <span style={{ color: "#22e36a", fontSize: 18 }}>$</span>
            <span>{gameDollarBalance.toFixed(2)}</span>
          </button>
          <button
            onClick={() => phase === "betting" && setActiveWallet("star")}
            className="h-12 rounded-2xl flex items-center justify-center gap-2 text-[16px] font-black"
            style={{
              background: "#13161d",
              border: activeWallet === "star" ? "2px solid #ffd84a" : "2px solid #1d2029",
              color: "#eaecf2",
              boxShadow: activeWallet === "star" ? "0 0 12px rgba(255,216,74,0.45)" : "none",
            }}
          >
            <span style={{ color: "#ffd84a", fontSize: 16 }}>⭐</span>
            <span>{Math.floor(gameStarBalance)}</span>
          </button>
        </div>

        {/* Row 5: Cash Out + Play */}
        <div className="flex items-center gap-1.5">
          {phase === "playing" && currentLane > 0 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={cashOut}
              className="h-14 px-3 rounded-2xl font-black flex flex-col items-center justify-center shrink-0"
              style={{
                minWidth: 96,
                background: "linear-gradient(180deg, #ffd84a 0%, #e89a1d 100%)",
                color: "#1a120a",
                border: "1.5px solid #ffe87a",
                boxShadow: "0 0 18px rgba(232,154,29,0.55), inset 0 -3px 0 rgba(120,60,0,0.5)",
              }}
            >
              <div className="text-[9px] tracking-wider">CASH OUT</div>
              <div className="text-[14px] leading-tight">
                {(selectedBet * currentMultiplier).toFixed(0)} {activeWallet === "dollar" ? "$" : "⭐"}
              </div>
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={phase === "betting" ? startGame : phase === "playing" ? goNext : resetToBet}
            className="flex-1 h-14 rounded-2xl font-black text-[22px]"
            style={{
              background: "linear-gradient(180deg, #44d96a 0%, #1f9c3e 100%)",
              color: "white",
              border: "1.5px solid #6df08a",
              boxShadow: "0 0 18px rgba(31,156,62,0.55), inset 0 -3px 0 rgba(0,60,15,0.5)",
              textShadow: "0 2px 0 rgba(0,0,0,0.35)",
            }}
          >
            {phase === "playing" ? "Go" : phase === "betting" ? "Play" : "Reset"}
          </motion.button>
        </div>

      </div>

      {/* ============ HOW TO PLAY MODAL ============ */}
      <AnimatePresence>
        {howOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={() => setHowOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-sm w-full rounded-2xl p-4 relative"
              style={{ background: "#101218", border: "1px solid #2a2c36", color: "#eaecf2" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setHowOpen(false)} className="absolute right-3 top-3">
                <X className="h-5 w-5" />
              </button>
              <h2 className="font-black text-lg mb-2">How to play</h2>
              <ol className="text-[12px] space-y-1.5 list-decimal pl-4" style={{ color: "#cfd2dc" }}>
                <li>Pick a bet amount and a Difficulty.</li>
                <li>Press <b>GO</b> — the chicken hops one lane forward.</li>
                <li>Each lane has a multiplier. Cash out before a vehicle hits!</li>
                <li>Higher difficulty = bigger multipliers but more risk.</li>
              </ol>
            </motion.div>
          </motion.div>
        )}
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-sm w-full rounded-2xl p-3 relative"
              style={{ background: "#101218", border: "1px solid #2a2c36", color: "#eaecf2" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setMenuOpen(false)} className="absolute right-3 top-3">
                <X className="h-5 w-5" />
              </button>
              <h2 className="font-black text-lg mb-2">Menu</h2>
              <div className="space-y-1.5">
                <button
                  onClick={() => { setSoundOn((p) => !p); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "#0d0f14", border: "1px solid #232735" }}
                >
                  Sound: {soundOn ? "On 🔊" : "Off 🔇"}
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "#0d0f14", border: "1px solid #232735" }}
                >
                  Back to lobby
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ COMPONENTS ============

const ChickenOnManhole = () => (
  <motion.div
    initial={{ scale: 0.6, opacity: 0 }}
    animate={{ scale: 1, opacity: 1, y: [0, -3, 0] }}
    transition={{ y: { duration: 0.9, repeat: Infinity } }}
    className="relative flex flex-col items-center"
  >
    {/* 3D Chicken */}
    <img
      src={chickenImg}
      alt="chicken"
      className="w-[68px] h-auto relative z-10 -mb-3"
      style={{ filter: "drop-shadow(0 6px 6px rgba(0,0,0,0.75))" }}
      loading="lazy"
    />
    {/* Golden drumstick manhole base */}
    <div
      className="h-6 w-16 rounded-full relative"
      style={{
        background:
          "radial-gradient(ellipse at 50% 35%, #ffe27a 0%, #e0a02a 55%, #7a4e10 100%)",
        boxShadow:
          "0 6px 12px rgba(0,0,0,0.7), inset 0 -3px 6px rgba(80,40,0,0.7), inset 0 2px 3px rgba(255,240,160,0.6)",
        border: "2px solid #8a5818",
      }}
    >
      <div
        className="absolute inset-[3px] rounded-full flex items-center justify-center text-[11px]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 25%, #ffd968 0%, #b87a18 100%)",
          boxShadow: "inset 0 0 6px rgba(60,30,0,0.6)",
        }}
      >
        🍗
      </div>
    </div>
  </motion.div>
);

const Signboard = ({ value }: { value: string; color?: string }) => (
  <div className="relative flex flex-col items-center" style={{ width: 72 }}>
    <div className="relative" style={{ width: 72, height: 56 }}>
      <img
        src={signboardImg}
        alt=""
        className="absolute inset-0 w-full h-full object-contain"
        style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.7))" }}
        loading="lazy"
      />
      <div
        className="absolute inset-0 flex items-start justify-center pt-[14px]"
      >
        <span
          className="font-black text-white"
          style={{
            fontSize: 14,
            textShadow: "0 0 6px rgba(80,180,255,0.9), 0 2px 2px rgba(0,0,0,0.8)",
            letterSpacing: 0.5,
          }}
        >
          {value}
        </span>
      </div>
    </div>
  </div>
);

const ManholeCover = ({ label, crossed }: { label: string; crossed: boolean }) => (
  <div
    className="relative flex items-center justify-center"
    style={{ width: 60, height: 60 }}
  >
    <img
      src={manholeImg}
      alt=""
      className="absolute inset-0 w-full h-full object-contain"
      style={{
        filter: crossed
          ? "drop-shadow(0 0 12px rgba(80,220,120,0.8)) hue-rotate(80deg) saturate(1.4)"
          : "drop-shadow(0 4px 6px rgba(0,0,0,0.7))",
      }}
      loading="lazy"
    />
    <span
      className="relative font-black z-10"
      style={{
        fontSize: label.length > 4 ? 11 : 14,
        color: "#ffffff",
        textShadow:
          "0 0 6px rgba(0,0,0,0.95), 0 2px 3px rgba(0,0,0,0.9), 0 0 2px rgba(255,255,255,0.4)",
      }}
    >
      {label}
    </span>
  </div>
);

const Truck = ({ color: _color }: { color?: string }) => (
  <div className="relative" style={{ width: 56 }}>
    <div
      className="absolute left-1/2 -translate-x-1/2 -bottom-6 w-12 h-10 pointer-events-none"
      style={{
        background:
          "radial-gradient(ellipse at top, rgba(255,240,180,0.7) 0%, transparent 70%)",
      }}
    />
    <img
      src={truckImg}
      alt=""
      className="w-full h-auto block"
      style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.7))" }}
      loading="lazy"
    />
  </div>
);

const Car = ({ color: _color }: { color?: string }) => (
  <div className="relative" style={{ width: 44 }}>
    <div
      className="absolute left-1/2 -translate-x-1/2 -bottom-5 w-10 h-8 pointer-events-none"
      style={{
        background:
          "radial-gradient(ellipse at top, rgba(255,240,180,0.6) 0%, transparent 70%)",
      }}
    />
    <img
      src={carImg}
      alt=""
      className="w-full h-auto block"
      style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.7))" }}
      loading="lazy"
    />
  </div>
);

export default ChickenRoadGame;
