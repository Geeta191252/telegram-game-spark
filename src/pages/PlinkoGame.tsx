import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, Music, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

// 16-line medium-risk multipliers (17 buckets, symmetric)
const MULTIPLIERS = [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110];
const ROWS = 16; // pegs rows -> ROWS+1 buckets (= 17)
const BUCKETS = MULTIPLIERS.length; // 17

const BET_PRESETS = [1, 5, 10, 50, 100];

// Weighted bucket selection — heavily biased to center (rigged for house edge)
// Lower multipliers (center) are favored.
const pickRiggedBucket = (): number => {
  // Target distribution (sums to 1) — favor center indices 7,8,9 (0.5x, 0.3x, 0.5x)
  const weights = [
    0.001, 0.003, 0.01, 0.025, 0.04, 0.08, 0.13, 0.18,
    0.22,
    0.18, 0.13, 0.08, 0.04, 0.025, 0.01, 0.003, 0.001,
  ];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 8;
};

// Build a path: ROWS L/R moves. Number of "right" moves = target bucket index.
const buildPath = (targetBucket: number): boolean[] => {
  const rights = Math.max(0, Math.min(ROWS, targetBucket));
  const moves: boolean[] = [];
  for (let i = 0; i < ROWS; i++) moves.push(i < rights);
  // Shuffle
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [moves[i], moves[j]] = [moves[j], moves[i]];
  }
  return moves;
};

const bucketColor = (mult: number): string => {
  if (mult >= 50) return "linear-gradient(180deg, hsl(45 95% 60%), hsl(25 85% 45%))";
  if (mult >= 5) return "linear-gradient(180deg, hsl(0 80% 55%), hsl(330 70% 45%))";
  if (mult >= 1.5) return "linear-gradient(180deg, hsl(310 70% 55%), hsl(280 60% 45%))";
  if (mult >= 1) return "linear-gradient(180deg, hsl(280 60% 55%), hsl(260 55% 45%))";
  return "linear-gradient(180deg, hsl(260 55% 50%), hsl(250 50% 38%))";
};

const PlinkoGame = () => {
  const navigate = useNavigate();
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const soundRef = useRef(true);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

  useEffect(() => {
    if (musicOn) startBgMusic();
    else stopBgMusic();
    return () => { stopBgMusic(); };
  }, [musicOn]);

  const { dollarBalance, starBalance, dollarWinning, starWinning, refreshBalance } = useBalanceContext();
  const [localDollarAdj, setLocalDollarAdj] = useState(0);
  const [localStarAdj, setLocalStarAdj] = useState(0);
  const gameDollarBalance = dollarBalance + dollarWinning + localDollarAdj;
  const gameStarBalance = starBalance + starWinning + localStarAdj;

  const [activeWallet, setActiveWallet] = useState<"dollar" | "star">("dollar");
  const [bet, setBet] = useState(1);
  const [dropping, setDropping] = useState(false);
  const [ballPath, setBallPath] = useState<{ x: number; y: number }[]>([]);
  const [ballStep, setBallStep] = useState(-1);
  const [highlightBucket, setHighlightBucket] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [lastMult, setLastMult] = useState<number | null>(null);

  const currentBalance = activeWallet === "dollar" ? gameDollarBalance : gameStarBalance;

  // Geometry of pegs / board
  // Triangle: row r has r+3 pegs (rows 0..ROWS-1)
  // Use percentages so we can render flexibly
  const BOARD_W = 100; // percent
  const PEG_TOP = 4; // %
  const PEG_BOTTOM = 88; // %
  const HORIZONTAL_SPACING = 4.4; // % per peg gap

  const computePath = useCallback((moves: boolean[]) => {
    const points: { x: number; y: number }[] = [];
    let x = 50; // start at center top
    points.push({ x, y: PEG_TOP - 4 });
    const rowGap = (PEG_BOTTOM - PEG_TOP) / (ROWS - 1);
    const half = HORIZONTAL_SPACING / 2;
    for (let r = 0; r < ROWS; r++) {
      const y = PEG_TOP + r * rowGap;
      points.push({ x, y });
      x += moves[r] ? half : -half;
    }
    // Final fall into bucket
    points.push({ x, y: PEG_BOTTOM + 6 });
    return points;
  }, []);

  const drop = useCallback(async () => {
    if (dropping) return;
    if (currentBalance < bet) return;

    // Deduct bet
    if (activeWallet === "dollar") setLocalDollarAdj((p) => p - bet);
    else setLocalStarAdj((p) => p - bet);
    if (soundRef.current) playBetSound();

    const target = pickRiggedBucket();
    const moves = buildPath(target);
    const path = computePath(moves);

    setLastWin(null);
    setLastMult(null);
    setHighlightBucket(null);
    setBallPath(path);
    setBallStep(0);
    setDropping(true);

    // Animate step by step
    const stepMs = 110;
    for (let i = 1; i < path.length; i++) {
      await new Promise((r) => setTimeout(r, stepMs));
      setBallStep(i);
      if (soundRef.current && i % 2 === 0) playResultReveal();
    }
    await new Promise((r) => setTimeout(r, 200));

    const mult = MULTIPLIERS[target];
    const win = Math.floor(bet * mult * 100) / 100;
    setHighlightBucket(target);
    setLastMult(mult);
    setLastWin(win);

    if (win >= bet) {
      if (soundRef.current) playWinSound();
    } else {
      if (soundRef.current) playLoseSound();
    }

    try {
      await reportGameResult({
        betAmount: bet,
        winAmount: win,
        currency: activeWallet,
        game: "plinko",
      });
      setLocalDollarAdj(0);
      setLocalStarAdj(0);
      refreshBalance();
    } catch (e) {
      console.error(e);
    }

    await new Promise((r) => setTimeout(r, 800));
    setDropping(false);
    setBallStep(-1);
  }, [dropping, currentBalance, bet, activeWallet, computePath, refreshBalance]);

  const adjustBet = (delta: number) => {
    setBet((b) => Math.max(1, b + delta));
  };

  const ballPos = ballStep >= 0 && ballPath[ballStep] ? ballPath[ballStep] : null;

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden relative"
      style={{
        background:
          "radial-gradient(ellipse at top, hsl(265 70% 25%) 0%, hsl(260 75% 12%) 70%, hsl(255 80% 6%) 100%)",
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 z-10">
        <button
          onClick={() => navigate("/")}
          className="h-9 px-3 rounded-lg flex items-center gap-1.5 font-semibold text-xs"
          style={{
            background: "hsla(0,0%,0%,0.5)",
            color: "hsl(0 0% 95%)",
            border: "1px solid hsla(45,80%,55%,0.2)",
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveWallet("dollar")}
            className="px-2.5 py-1 rounded-full text-[10px] font-bold"
            style={{
              background:
                activeWallet === "dollar"
                  ? "linear-gradient(135deg, hsl(140 65% 42%), hsl(160 55% 38%))"
                  : "hsla(0,0%,100%,0.08)",
              color: activeWallet === "dollar" ? "hsl(0 0% 100%)" : "hsl(260 30% 70%)",
            }}
          >
            💲 {gameDollarBalance.toFixed(2)}
          </button>
          <button
            onClick={() => setActiveWallet("star")}
            className="px-2.5 py-1 rounded-full text-[10px] font-bold"
            style={{
              background:
                activeWallet === "star"
                  ? "linear-gradient(135deg, hsl(40 90% 50%), hsl(25 85% 45%))"
                  : "hsla(0,0%,100%,0.08)",
              color: activeWallet === "star" ? "hsl(0 0% 10%)" : "hsl(260 30% 70%)",
            }}
          >
            ⭐ {gameStarBalance.toLocaleString()}
          </button>
        </div>
      </div>

      {/* Plinko Logo / Tent */}
      <div className="relative flex items-center justify-center pt-1 pb-2">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-center"
        >
          <h1
            className="font-black text-3xl tracking-wider"
            style={{
              background:
                "linear-gradient(135deg, hsl(45 100% 65%), hsl(15 95% 55%), hsl(0 90% 55%))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 10px hsla(45,90%,55%,0.6))",
              fontFamily: "'Fredoka','Comic Sans MS',cursive",
            }}
          >
            🎪 Plinko
          </h1>
        </motion.div>
        {/* Tent banner */}
        <div
          className="absolute top-0 left-0 right-0 h-16 -z-0 opacity-60 pointer-events-none"
          style={{
            background:
              "repeating-linear-gradient(90deg, hsl(0 75% 50%) 0 16px, hsl(0 0% 100%) 16px 32px)",
            clipPath: "polygon(0 0, 100% 0, 95% 60%, 50% 100%, 5% 60%)",
            opacity: 0.18,
          }}
        />
      </div>

      {/* Lines display */}
      <div className="absolute right-3 top-20 z-20">
        <div
          className="rounded-full px-2 py-1 flex flex-col items-center"
          style={{
            background: "linear-gradient(135deg, hsl(280 60% 35%), hsl(260 55% 25%))",
            border: "1.5px solid hsl(45 85% 60%)",
            boxShadow: "0 0 12px hsla(280, 60%, 50%, 0.5)",
          }}
        >
          <span className="text-[9px] font-bold" style={{ color: "hsl(45 90% 65%)" }}>LINES</span>
          <div className="flex items-center gap-1">
            <ChevronLeft className="h-3 w-3" style={{ color: "hsl(45 90% 60%)" }} />
            <span className="font-black text-sm" style={{ color: "hsl(0 0% 100%)" }}>16</span>
            <ChevronRight className="h-3 w-3" style={{ color: "hsl(45 90% 60%)" }} />
          </div>
        </div>
      </div>

      {/* Plinko Board */}
      <div className="flex-1 px-2 relative">
        <div
          className="relative w-full mx-auto rounded-2xl overflow-hidden"
          style={{
            aspectRatio: "0.78",
            maxWidth: "460px",
            background:
              "radial-gradient(ellipse at center top, hsl(270 70% 30%) 0%, hsl(260 75% 18%) 60%, hsl(255 80% 12%) 100%)",
            border: "2px solid hsla(45, 80%, 55%, 0.3)",
            boxShadow: "inset 0 0 40px hsla(280, 70%, 30%, 0.5), 0 0 30px hsla(280, 60%, 30%, 0.4)",
          }}
        >
          {/* Spotlight rays */}
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background:
                "conic-gradient(from 270deg at 50% 0%, transparent 0deg, hsla(45,90%,70%,0.3) 30deg, transparent 60deg, hsla(45,90%,70%,0.3) 90deg, transparent 120deg, hsla(45,90%,70%,0.3) 150deg, transparent 180deg)",
            }}
          />

          {/* Pegs */}
          {Array.from({ length: ROWS }).map((_, r) => {
            const pegCount = r + 3;
            const rowGap = (PEG_BOTTOM - PEG_TOP) / (ROWS - 1);
            const y = PEG_TOP + r * rowGap;
            const totalWidth = (pegCount - 1) * (HORIZONTAL_SPACING / 2);
            const startX = 50 - totalWidth;
            return (
              <div key={r} className="absolute left-0 right-0" style={{ top: `${y}%` }}>
                {Array.from({ length: pegCount }).map((_, p) => {
                  const x = startX + p * (HORIZONTAL_SPACING / 2);
                  return (
                    <motion.div
                      key={p}
                      className="absolute rounded-full"
                      style={{
                        left: `${x}%`,
                        width: 5,
                        height: 5,
                        transform: "translate(-50%, -50%)",
                        background:
                          "radial-gradient(circle, hsl(45 100% 70%), hsl(35 95% 55%))",
                        boxShadow: "0 0 4px hsla(45, 95%, 60%, 0.9)",
                      }}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Ball */}
          <AnimatePresence>
            {ballPos && (
              <motion.div
                key="ball"
                initial={false}
                animate={{ left: `${ballPos.x}%`, top: `${ballPos.y}%` }}
                transition={{ duration: 0.1, ease: "easeIn" }}
                className="absolute rounded-full z-30"
                style={{
                  width: 12,
                  height: 12,
                  transform: "translate(-50%, -50%)",
                  background:
                    "radial-gradient(circle at 30% 30%, hsl(0 0% 100%), hsl(45 95% 60%) 60%, hsl(15 90% 45%))",
                  boxShadow:
                    "0 0 10px hsla(45,95%,60%,0.9), 0 0 18px hsla(15,95%,55%,0.5)",
                }}
              />
            )}
          </AnimatePresence>

          {/* Buckets */}
          <div className="absolute left-0 right-0" style={{ bottom: 0, height: "10%" }}>
            <div className="flex w-full h-full px-[2%]">
              {MULTIPLIERS.map((m, i) => {
                const isHit = highlightBucket === i;
                return (
                  <motion.div
                    key={i}
                    animate={isHit ? { scale: [1, 1.25, 1], y: [0, -4, 0] } : {}}
                    transition={{ duration: 0.5, repeat: isHit ? 2 : 0 }}
                    className="flex-1 mx-[1px] rounded-t-md flex items-end justify-center pb-0.5 relative"
                    style={{
                      background: bucketColor(m),
                      border: isHit
                        ? "1.5px solid hsl(45 100% 70%)"
                        : "1px solid hsla(0,0%,100%,0.15)",
                      boxShadow: isHit
                        ? "0 0 12px hsla(45,95%,60%,0.9), inset 0 0 8px hsla(45,95%,60%,0.5)"
                        : "inset 0 -4px 8px hsla(0,0%,0%,0.3)",
                    }}
                  >
                    <span
                      className="font-black text-[8px] leading-none"
                      style={{ color: "hsl(0 0% 100%)", textShadow: "0 1px 2px hsla(0,0%,0%,0.6)" }}
                    >
                      {m < 1 ? m : m % 1 === 0 ? `${m}x` : `${m}x`}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Win banner */}
        <AnimatePresence>
          {lastWin !== null && lastMult !== null && (
            <motion.div
              key="winbanner"
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl z-40"
              style={{
                top: "20%",
                background:
                  lastWin >= bet
                    ? "linear-gradient(135deg, hsl(140 75% 45%), hsl(160 70% 38%))"
                    : "linear-gradient(135deg, hsl(0 70% 50%), hsl(330 60% 42%))",
                boxShadow: "0 6px 20px hsla(0,0%,0%,0.5)",
                border: "2px solid hsl(45 90% 65%)",
              }}
            >
              <div className="text-center">
                <div className="text-[10px] font-bold opacity-90" style={{ color: "hsl(0 0% 100%)" }}>
                  {lastMult}x
                </div>
                <div className="font-black text-base" style={{ color: "hsl(0 0% 100%)" }}>
                  {lastWin >= bet ? "+ " : ""}
                  {activeWallet === "dollar" ? "$" : ""}
                  {lastWin.toFixed(2)}
                  {activeWallet === "star" ? " ⭐" : ""}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="px-3 pb-3 pt-2 z-10">
        <div className="grid grid-cols-3 gap-2 items-end">
          {/* Risk Level (display only) */}
          <div className="text-center">
            <div className="text-[10px] font-bold mb-1" style={{ color: "hsl(45 90% 65%)" }}>
              RISK LEVEL
            </div>
            <div className="flex justify-center gap-1">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center"
                style={{ background: "hsla(0,0%,0%,0.5)", border: "1.5px solid hsla(0,0%,100%,0.15)" }}
              >
                <span className="text-xs">🔥</span>
              </div>
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, hsl(25 95% 55%), hsl(0 85% 50%))",
                  boxShadow: "0 0 10px hsla(25,90%,55%,0.7)",
                  border: "2px solid hsl(45 90% 65%)",
                }}
              >
                <span className="text-sm">🔥</span>
              </div>
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center"
                style={{ background: "hsla(0,0%,0%,0.5)", border: "1.5px solid hsla(0,0%,100%,0.15)" }}
              >
                <span className="text-xs">🔥</span>
              </div>
            </div>
          </div>

          {/* Play button */}
          <div className="flex justify-center">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={drop}
              disabled={dropping || currentBalance < bet}
              className="h-16 w-16 rounded-full font-black text-sm relative"
              style={{
                background:
                  dropping || currentBalance < bet
                    ? "linear-gradient(135deg, hsl(0 30% 35%), hsl(0 25% 25%))"
                    : "linear-gradient(135deg, hsl(0 85% 55%), hsl(345 80% 45%))",
                color: "hsl(0 0% 100%)",
                border: "3px solid hsl(45 90% 60%)",
                boxShadow:
                  dropping || currentBalance < bet
                    ? "none"
                    : "0 0 20px hsla(0,85%,55%,0.7), inset 0 -4px 8px hsla(0,0%,0%,0.3)",
                textShadow: "0 1px 2px hsla(0,0%,0%,0.5)",
              }}
            >
              {dropping ? "..." : "PLAY"}
            </motion.button>
          </div>

          {/* Bet amount */}
          <div className="text-center">
            <div className="text-[10px] font-bold mb-1" style={{ color: "hsl(45 90% 65%)" }}>
              BET AMOUNT
            </div>
            <div
              className="flex items-center justify-between rounded-full px-1 py-1"
              style={{
                background: "linear-gradient(135deg, hsl(280 50% 25%), hsl(260 45% 18%))",
                border: "1.5px solid hsl(45 80% 55%)",
              }}
            >
              <button
                onClick={() => adjustBet(-1)}
                disabled={dropping}
                className="h-6 w-6 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, hsl(45 90% 55%), hsl(35 85% 45%))" }}
              >
                <ChevronLeft className="h-3.5 w-3.5" style={{ color: "hsl(0 0% 10%)" }} />
              </button>
              <span className="font-black text-xs" style={{ color: "hsl(0 0% 100%)" }}>
                {bet}
              </span>
              <button
                onClick={() => adjustBet(1)}
                disabled={dropping}
                className="h-6 w-6 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, hsl(45 90% 55%), hsl(35 85% 45%))" }}
              >
                <ChevronRight className="h-3.5 w-3.5" style={{ color: "hsl(0 0% 10%)" }} />
              </button>
            </div>
          </div>
        </div>

        {/* Bet presets */}
        <div className="flex justify-center gap-1.5 mt-2">
          {BET_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setBet((b) => b + p)}
              disabled={dropping}
              className="px-2 py-1 rounded-full text-[10px] font-bold"
              style={{
                background: "hsla(45,80%,55%,0.15)",
                color: "hsl(45 90% 70%)",
                border: "1px solid hsla(45,80%,55%,0.35)",
              }}
            >
              +{p}
            </button>
          ))}
          <button
            onClick={() => setBet(1)}
            disabled={dropping}
            className="px-2 py-1 rounded-full text-[10px] font-bold"
            style={{
              background: "hsla(0,70%,50%,0.15)",
              color: "hsl(0 80% 70%)",
              border: "1px solid hsla(0,70%,50%,0.35)",
            }}
          >
            Reset
          </button>
        </div>

        {/* Sound toggles */}
        <div className="flex gap-2 mt-2 justify-center">
          <button
            onClick={() => setSoundOn((s) => !s)}
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{ background: "hsla(0,0%,0%,0.4)", border: "1px solid hsla(45,80%,55%,0.25)" }}
          >
            {soundOn ? (
              <Volume2 className="h-4 w-4" style={{ color: "hsl(45 90% 65%)" }} />
            ) : (
              <VolumeX className="h-4 w-4" style={{ color: "hsl(0 60% 60%)" }} />
            )}
          </button>
          <button
            onClick={() => setMusicOn((s) => !s)}
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{ background: "hsla(0,0%,0%,0.4)", border: "1px solid hsla(45,80%,55%,0.25)" }}
          >
            <Music
              className="h-4 w-4"
              style={{ color: musicOn ? "hsl(45 90% 65%)" : "hsl(0 0% 50%)" }}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlinkoGame;
