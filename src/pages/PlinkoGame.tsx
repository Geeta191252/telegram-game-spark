import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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

type Risk = "low" | "medium" | "high";

// Multiplier tables: [risk][lines] => array length lines+1 (symmetric)
const MULTIPLIER_TABLE: Record<Risk, Record<number, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    9: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
    10: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
    11: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
    12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    13: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
    14: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
    15: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    9: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
    10: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
    11: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    13: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
    14: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
    15: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    9: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
    10: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
    11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    13: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
    14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
    15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

const BET_PRESETS = [1, 5, 10, 50, 100];

// Build weights biased to center for rigging (more bias = bigger house edge)
const buildRiggedWeights = (lines: number, risk: Risk): number[] => {
  const n = lines + 1;
  const center = (n - 1) / 2;
  // bias factor: high risk -> tighter to center; low risk -> spread a bit
  const sigma = risk === "high" ? n * 0.13 : risk === "medium" ? n * 0.18 : n * 0.24;
  const w: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = (i - center) / sigma;
    w.push(Math.exp(-0.5 * d * d));
  }
  return w;
};

const pickRiggedBucket = (lines: number, risk: Risk): number => {
  const w = buildRiggedWeights(lines, risk);
  const total = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return i;
  }
  return Math.floor(lines / 2);
};

const buildPath = (targetBucket: number, lines: number): boolean[] => {
  const rights = Math.max(0, Math.min(lines, targetBucket));
  const moves: boolean[] = [];
  for (let i = 0; i < lines; i++) moves.push(i < rights);
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
  const [lines, setLines] = useState(16);
  const [risk, setRisk] = useState<Risk>("medium");
  const [dropping, setDropping] = useState(false);
  const [ballPath, setBallPath] = useState<{ x: number; y: number }[]>([]);
  const [ballStep, setBallStep] = useState(-1);
  const [highlightBucket, setHighlightBucket] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [lastMult, setLastMult] = useState<number | null>(null);

  const multipliers = useMemo(() => MULTIPLIER_TABLE[risk][lines], [risk, lines]);
  const currentBalance = activeWallet === "dollar" ? gameDollarBalance : gameStarBalance;

  // Geometry
  const PEG_TOP = 12;
  const PEG_BOTTOM = 84;
  // Board geometry: pegs are centered row-by-row and the bottom row spans
  // the same 2%–98% width used by the multiplier buckets.
  const BOARD_SIDE_INSET = 2;
  const PLAY_WIDTH = 100 - BOARD_SIDE_INSET * 2;
  const BUCKET_WIDTH = useMemo(() => PLAY_WIDTH / (lines + 1), [lines]);
  const PEG_GAP = BUCKET_WIDTH;
  const BALL_STEP_X = BUCKET_WIDTH / 2;

  const computePath = useCallback((moves: boolean[]) => {
    const points: { x: number; y: number }[] = [];
    let x = 50;
    points.push({ x, y: PEG_TOP - 4 });
    const rowGap = (PEG_BOTTOM - PEG_TOP) / Math.max(1, lines - 1);
    const half = BALL_STEP_X;
    for (let r = 0; r < lines; r++) {
      const y = PEG_TOP + r * rowGap;
      points.push({ x, y });
      x += moves[r] ? half : -half;
    }
    points.push({ x, y: PEG_BOTTOM + 6 });
    return points;
  }, [lines, BALL_STEP_X]);

  const drop = useCallback(async () => {
    if (dropping) return;
    if (currentBalance < bet) return;

    if (activeWallet === "dollar") setLocalDollarAdj((p) => p - bet);
    else setLocalStarAdj((p) => p - bet);
    if (soundRef.current) playBetSound();

    const target = pickRiggedBucket(lines, risk);
    const moves = buildPath(target, lines);
    const path = computePath(moves);

    setLastWin(null);
    setLastMult(null);
    setHighlightBucket(null);
    setBallPath(path);
    setBallStep(0);
    setDropping(true);

    const stepMs = 110;
    for (let i = 1; i < path.length; i++) {
      await new Promise((r) => setTimeout(r, stepMs));
      setBallStep(i);
      if (soundRef.current && i % 2 === 0) playResultReveal();
    }
    await new Promise((r) => setTimeout(r, 200));

    const mult = multipliers[target];
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
  }, [dropping, currentBalance, bet, activeWallet, computePath, refreshBalance, lines, risk, multipliers]);

  const adjustBet = (delta: number) => setBet((b) => Math.max(1, b + delta));
  const adjustLines = (delta: number) => {
    if (dropping) return;
    setLines((l) => Math.max(8, Math.min(16, l + delta)));
    setHighlightBucket(null);
    setLastWin(null);
    setLastMult(null);
  };
  const cycleRisk = () => {
    if (dropping) return;
    setRisk((r) => (r === "low" ? "medium" : r === "medium" ? "high" : "low"));
    setHighlightBucket(null);
    setLastWin(null);
    setLastMult(null);
  };

  const ballPos = ballStep >= 0 && ballPath[ballStep] ? ballPath[ballStep] : null;

  const riskColor =
    risk === "low"
      ? "linear-gradient(135deg, hsl(140 70% 45%), hsl(160 65% 38%))"
      : risk === "medium"
      ? "linear-gradient(135deg, hsl(25 95% 55%), hsl(0 85% 50%))"
      : "linear-gradient(135deg, hsl(0 90% 55%), hsl(330 80% 42%))";
  const riskLabel = risk === "low" ? "LOW" : risk === "medium" ? "MED" : "HIGH";

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden relative"
      style={{
        background:
          "radial-gradient(ellipse at top, hsl(230 80% 35%) 0%, hsl(245 85% 18%) 55%, hsl(255 90% 8%) 100%)",
      }}
    >
      {/* Light rays from top */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "conic-gradient(from 250deg at 50% 0%, transparent 0deg, hsla(210,90%,75%,0.25) 25deg, transparent 50deg, hsla(210,90%,75%,0.25) 75deg, transparent 100deg, hsla(210,90%,75%,0.25) 130deg, transparent 160deg)",
        }}
      />

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

      {/* Plinko Logo + Tent */}
      <div className="relative flex items-center justify-center pt-2 pb-3 z-10">
        {/* Tent stripes behind */}
        <div
          className="absolute top-0 left-0 right-0 h-20 pointer-events-none"
          style={{
            background:
              "repeating-linear-gradient(90deg, hsl(0 80% 50%) 0 18px, hsl(0 0% 98%) 18px 36px)",
            clipPath: "polygon(0 60%, 8% 30%, 20% 55%, 32% 25%, 44% 55%, 56% 25%, 68% 55%, 80% 25%, 92% 55%, 100% 30%, 100% 100%, 0 100%)",
            opacity: 0.85,
            filter: "drop-shadow(0 4px 6px hsla(0,0%,0%,0.4))",
          }}
        />
        {/* Flag bunting */}
        <div className="absolute top-[68px] left-2 right-2 flex justify-between pointer-events-none">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: `10px solid ${
                  ["hsl(45 95% 55%)", "hsl(0 80% 55%)", "hsl(200 85% 55%)", "hsl(140 70% 50%)"][i % 4]
                }`,
                filter: "drop-shadow(0 2px 2px hsla(0,0%,0%,0.4))",
              }}
            />
          ))}
        </div>

        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative z-10"
        >
          <h1
            className="font-black text-4xl tracking-wider"
            style={{
              background:
                "linear-gradient(180deg, hsl(50 100% 65%) 0%, hsl(35 100% 55%) 45%, hsl(15 95% 50%) 55%, hsl(0 90% 45%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 2px 0 hsl(0 0% 0%)) drop-shadow(0 0 12px hsla(45,95%,55%,0.7))",
              fontFamily: "'Fredoka','Comic Sans MS',cursive",
              WebkitTextStroke: "1.5px hsl(0 0% 0%)",
            }}
          >
            Plinko
          </h1>
        </motion.div>
      </div>

      {/* Lines selector */}
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
            <button onClick={() => adjustLines(-1)} disabled={dropping || lines <= 8}>
              <ChevronLeft className="h-3.5 w-3.5" style={{ color: "hsl(45 90% 60%)" }} />
            </button>
            <span className="font-black text-sm w-5 text-center" style={{ color: "hsl(0 0% 100%)" }}>{lines}</span>
            <button onClick={() => adjustLines(1)} disabled={dropping || lines >= 16}>
              <ChevronRight className="h-3.5 w-3.5" style={{ color: "hsl(45 90% 60%)" }} />
            </button>
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
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background:
                "conic-gradient(from 270deg at 50% 0%, transparent 0deg, hsla(45,90%,70%,0.3) 30deg, transparent 60deg, hsla(45,90%,70%,0.3) 90deg, transparent 120deg, hsla(45,90%,70%,0.3) 150deg, transparent 180deg)",
            }}
          />

          {/* Pegs */}
          {Array.from({ length: lines }).map((_, r) => {
            const pegCount = r + 3;
            const rowGap = (PEG_BOTTOM - PEG_TOP) / Math.max(1, lines - 1);
            const y = PEG_TOP + r * rowGap;
            const totalWidth = (pegCount - 1) * PEG_GAP;
            const startX = 50 - totalWidth / 2;
            return (
              <div key={r} className="absolute left-0 right-0" style={{ top: `${y}%` }}>
                {Array.from({ length: pegCount }).map((_, p) => {
                  const x = startX + p * PEG_GAP;
                  return (
                    <div
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

          {/* Buckets — drum style with multiplier label below */}
          <div className="absolute left-0 right-0" style={{ bottom: 0, height: "14%" }}>
            <div className="flex w-full h-full px-[2%] items-end">
              {multipliers.map((m, i) => {
                const isHit = highlightBucket === i;
                // Vibrant drum palette cycling per bucket
                const palette = [
                  ["hsl(35 100% 55%)", "hsl(20 95% 45%)"],   // orange
                  ["hsl(0 90% 55%)", "hsl(350 85% 42%)"],    // red
                  ["hsl(285 75% 55%)", "hsl(265 70% 42%)"],  // purple
                  ["hsl(320 85% 55%)", "hsl(300 75% 42%)"],  // magenta
                ];
                // Symmetric: distance from center determines color tier
                const center = (multipliers.length - 1) / 2;
                const tier = Math.min(palette.length - 1, Math.round(Math.abs(i - center)));
                const [c1, c2] = palette[tier];
                return (
                  <motion.div
                    key={i}
                    animate={isHit ? { scale: [1, 1.25, 1], y: [0, -6, 0] } : {}}
                    transition={{ duration: 0.5, repeat: isHit ? 2 : 0 }}
                    className="flex-1 mx-[1px] flex flex-col items-center justify-end relative"
                  >
                    {/* Drum body */}
                    <div
                      className="w-full"
                      style={{
                        height: "62%",
                        borderTopLeftRadius: 6,
                        borderTopRightRadius: 6,
                        borderBottomLeftRadius: 3,
                        borderBottomRightRadius: 3,
                        background: `linear-gradient(180deg, ${c1} 0%, ${c2} 100%)`,
                        border: isHit
                          ? "1.5px solid hsl(45 100% 70%)"
                          : "1px solid hsla(0,0%,0%,0.35)",
                        boxShadow: isHit
                          ? "0 0 12px hsla(45,95%,60%,0.9), inset 0 -4px 6px hsla(0,0%,0%,0.35)"
                          : "inset 0 -4px 6px hsla(0,0%,0%,0.45), inset 0 2px 3px hsla(0,0%,100%,0.35), 0 2px 3px hsla(0,0%,0%,0.4)",
                        position: "relative",
                      }}
                    >
                      {/* Drum top highlight ring */}
                      <div
                        className="absolute left-0 right-0"
                        style={{
                          top: 1,
                          height: 4,
                          borderRadius: "50%",
                          background:
                            "linear-gradient(180deg, hsla(0,0%,100%,0.5), hsla(0,0%,100%,0))",
                        }}
                      />
                    </div>
                    {/* Multiplier label below */}
                    <span
                      className="font-black leading-none mt-0.5"
                      style={{
                        color: "hsl(45 95% 70%)",
                        textShadow: "0 1px 2px hsla(0,0%,0%,0.8)",
                        fontSize: lines >= 14 ? 7 : lines >= 11 ? 8 : 10,
                      }}
                    >
                      {m}x
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
          {/* Risk Level */}
          <div className="text-center">
            <div className="text-[10px] font-bold mb-1" style={{ color: "hsl(45 90% 65%)" }}>
              RISK LEVEL
            </div>
            <button
              onClick={cycleRisk}
              disabled={dropping}
              className="h-9 px-3 rounded-full font-black text-xs flex items-center gap-1 mx-auto"
              style={{
                background: riskColor,
                color: "hsl(0 0% 100%)",
                border: "2px solid hsl(45 90% 65%)",
                boxShadow: "0 0 10px hsla(25,90%,55%,0.5)",
                textShadow: "0 1px 2px hsla(0,0%,0%,0.5)",
              }}
            >
              🔥 {riskLabel}
            </button>
          </div>

          {/* Play */}
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

          {/* Bet */}
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
