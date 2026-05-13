import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Volume2, VolumeX, Users, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import dragonImg from "@/assets/dragon-tiger/dragon-jade.png";
import tigerImg from "@/assets/dragon-tiger/tiger-white.png";
import arenaBg from "@/assets/dragon-tiger/arena-bg.jpg";

type Side = "dragon" | "tiger" | "tie";
type Phase = "betting" | "dealing" | "result";

interface CardData {
  rank: number; // 1-13
  suit: number; // 0-3
}

const SUITS = [
  { s: "♥", color: "hsl(0 80% 48%)" },
  { s: "♦", color: "hsl(0 80% 48%)" },
  { s: "♣", color: "hsl(0 0% 12%)" },
  { s: "♠", color: "hsl(0 0% 12%)" },
];
const RANK_LABELS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

interface Chip {
  value: number;
  label: string;
  inner: string;
  outer: string;
  text: string;
}
const CHIPS: Chip[] = [
  { value: 1,    label: "1",   inner: "hsl(0 0% 96%)",  outer: "hsl(0 0% 75%)",  text: "hsl(0 0% 20%)" },
  { value: 10,   label: "10",  inner: "hsl(140 70% 40%)", outer: "hsl(140 60% 25%)", text: "hsl(0 0% 100%)" },
  { value: 50,   label: "50",  inner: "hsl(210 75% 50%)", outer: "hsl(215 70% 30%)", text: "hsl(0 0% 100%)" },
  { value: 100,  label: "100", inner: "hsl(280 65% 50%)", outer: "hsl(285 60% 32%)", text: "hsl(0 0% 100%)" },
  { value: 500,  label: "500", inner: "hsl(28 90% 52%)",  outer: "hsl(20 85% 32%)",  text: "hsl(0 0% 100%)" },
  { value: 1000, label: "1K",  inner: "hsl(0 75% 50%)",   outer: "hsl(0 70% 30%)",   text: "hsl(0 0% 100%)" },
];

// Decorative side leaderboard names
const SIDE_PLAYERS_LEFT = [
  { name: "Kahn", amount: "2.6K" },
  { name: "Kapil", amount: "1.2K" },
  { name: "Avaso", amount: "940" },
];
const SIDE_PLAYERS_RIGHT = [
  { name: "Arun", amount: "3.2K" },
  { name: "Sumi", amount: "1.0K" },
  { name: "Cyrus", amount: "870" },
];

const DragonTigerGame = () => {
  const navigate = useNavigate();
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

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

  const [phase, setPhase] = useState<Phase>("betting");
  const [dragonCard, setDragonCard] = useState<CardData | null>(null);
  const [tigerCard, setTigerCard] = useState<CardData | null>(null);
  const [winner, setWinner] = useState<Side | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  const [totalLost, setTotalLost] = useState(0);
  const [resultTimer, setResultTimer] = useState(4);
  const [round, setRound] = useState(1);
  const [history, setHistory] = useState<Side[]>([]);
  // Decorative pool totals (give the table a busy "live casino" feel)
  const [pool] = useState(() => ({
    dragon: 50000 + Math.floor(Math.random() * 20000),
    tie: 2500 + Math.floor(Math.random() * 1500),
    tiger: 50000 + Math.floor(Math.random() * 20000),
  }));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (soundOn) startBgMusic(); else stopBgMusic();
    return () => stopBgMusic();
  }, [soundOn]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const totalBet = bets.dragon + bets.tiger + bets.tie;
  const sym = activeWallet === "dollar" ? "$" : "⭐";

  const addBet = (side: Side) => {
    if (phase !== "betting") return;
    if (currentBalance < totalBet + chip) return;
    setBets((p) => ({ ...p, [side]: p[side] + chip }));
    if (soundRef.current) playBetSound();
  };

  const clearBets = () => {
    if (phase !== "betting") return;
    setBets({ dragon: 0, tiger: 0, tie: 0 });
  };

  const repeatBets = () => {
    if (phase !== "betting" || !lastBets) return;
    const total = lastBets.dragon + lastBets.tiger + lastBets.tie;
    if (currentBalance < total) return;
    setBets(lastBets);
    if (soundRef.current) playBetSound();
  };

  const deal = () => {
    if (phase !== "betting" || totalBet <= 0 || currentBalance < totalBet) return;

    if (activeWallet === "dollar") setLocalDollarAdj((p) => p - totalBet);
    else setLocalStarAdj((p) => p - totalBet);

    if (soundRef.current) playSpinSound();
    setLastBets(bets);
    setPhase("dealing");
    setDragonCard(null);
    setTigerCard(null);
    setWinner(null);

    // Rigged outcome — biased AGAINST the user
    let wDragon = 47, wTiger = 47, wTie = 6;
    if (bets.dragon > 0) wDragon *= 0.45;
    if (bets.tiger > 0) wTiger *= 0.45;
    if (bets.tie > 0) wTie *= 0.3;
    if (bets.dragon > 0 && bets.tiger === 0 && bets.tie === 0) wTiger *= 1.6;
    if (bets.tiger > 0 && bets.dragon === 0 && bets.tie === 0) wDragon *= 1.6;

    let r = Math.random() * (wDragon + wTiger + wTie);
    let outcome: Side = "dragon";
    if ((r -= wDragon) < 0) outcome = "dragon";
    else if ((r -= wTiger) < 0) outcome = "tiger";
    else outcome = "tie";

    let dRank: number, tRank: number;
    if (outcome === "tie") {
      dRank = Math.floor(Math.random() * 13) + 1;
      tRank = dRank;
    } else if (outcome === "dragon") {
      dRank = Math.floor(Math.random() * 12) + 2;
      tRank = Math.floor(Math.random() * (dRank - 1)) + 1;
    } else {
      tRank = Math.floor(Math.random() * 12) + 2;
      dRank = Math.floor(Math.random() * (tRank - 1)) + 1;
    }
    const finalDragon: CardData = { rank: dRank, suit: Math.floor(Math.random() * 4) };
    const finalTiger: CardData = { rank: tRank, suit: Math.floor(Math.random() * 4) };

    setTimeout(() => { setDragonCard(finalDragon); if (soundRef.current) playResultReveal(); }, 700);
    setTimeout(() => { setTigerCard(finalTiger); if (soundRef.current) playResultReveal(); }, 1500);

    setTimeout(() => {
      let payout = 0;
      if (outcome === "dragon") payout = bets.dragon * 2;
      else if (outcome === "tiger") payout = bets.tiger * 2;
      else { payout = bets.tie * 9 + (bets.dragon + bets.tiger) * 0.5; }
      payout = Math.round(payout * 100) / 100;
      const profit = payout - totalBet;

      setWinner(outcome);
      setHistory((h) => [outcome, ...h].slice(0, 14));
      setRound((r) => r + 1);

      if (payout > 0) {
        setWinAmount(payout); setTotalLost(0);
        if (profit > 0 && soundRef.current) playWinSound();
        else if (soundRef.current) playLoseSound();
      } else {
        setWinAmount(0); setTotalLost(totalBet);
        if (soundRef.current) playLoseSound();
      }

      reportGameResult({ betAmount: totalBet, winAmount: payout, currency: activeWallet, game: "dragon-tiger" })
        .then(() => { setLocalDollarAdj(0); setLocalStarAdj(0); refreshBalance(); })
        .catch(console.error);

      setPhase("result");
      setResultTimer(4);
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
    }, 2400);
  };

  // ---------- 3D card ----------
  const renderCard = (card: CardData | null) => (
    <div style={{ perspective: 800 }}>
      <motion.div
        className="w-[60px] h-[84px] rounded-md relative"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: card ? 0 : 180 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 rounded-md flex flex-col items-start justify-between p-1"
          style={{
            backfaceVisibility: "hidden",
            background: "linear-gradient(160deg, hsl(45 30% 96%), hsl(40 25% 88%))",
            border: "2px solid hsl(45 60% 70%)",
            boxShadow: "0 4px 14px hsla(0,0%,0%,0.55), inset 0 2px 4px hsla(0,0%,100%,0.6)",
          }}
        >
          {card && (
            <>
              <div className="leading-none">
                <div className="font-black text-base leading-none" style={{ color: SUITS[card.suit].color }}>
                  {RANK_LABELS[card.rank - 1]}
                </div>
                <div className="text-xs leading-none" style={{ color: SUITS[card.suit].color }}>{SUITS[card.suit].s}</div>
              </div>
              <div className="self-center text-2xl leading-none" style={{ color: SUITS[card.suit].color }}>
                {SUITS[card.suit].s}
              </div>
              <div className="self-end leading-none rotate-180">
                <div className="font-black text-base leading-none" style={{ color: SUITS[card.suit].color }}>
                  {RANK_LABELS[card.rank - 1]}
                </div>
                <div className="text-xs leading-none" style={{ color: SUITS[card.suit].color }}>{SUITS[card.suit].s}</div>
              </div>
            </>
          )}
        </div>
        {/* Back */}
        <div
          className="absolute inset-0 rounded-md flex items-center justify-center"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: "repeating-linear-gradient(45deg, hsl(0 70% 28%) 0 5px, hsl(0 75% 22%) 5px 10px)",
            border: "2px solid hsl(45 90% 55%)",
            boxShadow: "0 4px 14px hsla(0,0%,0%,0.55)",
          }}
        >
          <span className="text-lg">🐉</span>
        </div>
      </motion.div>
    </div>
  );

  // ---------- Poker chip ----------
  const PokerChip = ({ chipDef, active, onClick, size = 48 }: { chipDef: Chip; active?: boolean; onClick?: () => void; size?: number }) => (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Outer ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: chipDef.outer,
          boxShadow: active
            ? `0 0 0 3px hsl(45 95% 60%), 0 6px 14px hsla(0,0%,0%,0.6)`
            : `0 4px 10px hsla(0,0%,0%,0.55), inset 0 -3px 0 hsla(0,0%,0%,0.35)`,
        }}
      />
      {/* Notches around the ring */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <div
          key={deg}
          className="absolute top-1/2 left-1/2 rounded-sm"
          style={{
            width: size * 0.12,
            height: size * 0.18,
            background: "hsl(0 0% 96%)",
            transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-${size * 0.42}px)`,
            opacity: 0.85,
          }}
        />
      ))}
      {/* Inner disc */}
      <div
        className="absolute rounded-full flex items-center justify-center"
        style={{
          inset: size * 0.18,
          background: `radial-gradient(circle at 35% 30%, ${chipDef.inner}, ${chipDef.outer})`,
          boxShadow: "inset 0 2px 3px hsla(0,0%,100%,0.4), inset 0 -2px 3px hsla(0,0%,0%,0.3)",
          border: `1px dashed ${chipDef.text}33`,
        }}
      >
        <span className="font-black" style={{ color: chipDef.text, fontSize: size * 0.32, textShadow: "0 1px 1px hsla(0,0%,0%,0.4)" }}>
          {chipDef.label}
        </span>
      </div>
    </motion.button>
  );

  // ---------- Bet pad ----------
  const BetPad = ({
    side,
    title,
    payout,
    icon,
    accent,
    bg,
    poolAmount,
  }: { side: Side; title: string; payout: string; icon: React.ReactNode; accent: string; bg: string; poolAmount: number }) => {
    const stake = bets[side];
    const isWinner = phase === "result" && winner === side;
    const dimmed = phase === "result" && winner && winner !== side;
    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => addBet(side)}
        disabled={phase !== "betting"}
        className="relative rounded-2xl overflow-hidden flex-1 flex flex-col items-center justify-end pb-2"
        style={{
          minHeight: 150,
          background: bg,
          border: `2px solid ${accent}`,
          boxShadow: isWinner
            ? `0 0 28px ${accent}, 0 0 60px ${accent}99, inset 0 0 28px ${accent}66`
            : `0 6px 18px hsla(0,0%,0%,0.55), inset 0 1px 0 hsla(0,0%,100%,0.18), inset 0 -2px 0 hsla(0,0%,0%,0.4)`,
          opacity: dimmed ? 0.55 : 1,
        }}
      >
        {/* Pool total chip on top */}
        <div
          className="absolute top-1.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[11px] font-black"
          style={{
            background: "hsla(0,0%,0%,0.55)",
            color: "hsl(45 95% 70%)",
            border: "1px solid hsla(45,90%,55%,0.4)",
            backdropFilter: "blur(4px)",
          }}
        >
          {(poolAmount + stake * 50).toLocaleString()}
        </div>

        {/* Centered icon (mascot or chips stack) */}
        <div className="flex-1 w-full flex items-center justify-center pt-5">
          {icon}
        </div>

        {/* Title */}
        <div
          className="font-black text-base tracking-widest"
          style={{
            color: accent,
            textShadow: `0 2px 4px hsla(0,0%,0%,0.7), 0 0 12px ${accent}55`,
          }}
        >
          {title}
        </div>
        <div
          className="text-[10px] font-bold opacity-90"
          style={{ color: accent }}
        >
          {payout}
        </div>

        {/* User stake badge */}
        {stake > 0 && (
          <div
            className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-full text-[10px] font-black"
            style={{
              background: "linear-gradient(135deg, hsl(45 95% 60%), hsl(25 90% 50%))",
              color: "hsl(0 0% 12%)",
              boxShadow: "0 2px 6px hsla(0,0%,0%,0.5)",
            }}
          >
            {sym}{stake}
          </div>
        )}

        {isWinner && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[9px] font-black"
            style={{ background: "hsl(140 80% 45%)", color: "hsl(0 0% 100%)" }}
          >
            WIN
          </motion.div>
        )}
      </motion.button>
    );
  };

  // ---------- LAYOUT ----------
  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Background scene */}
      <div className="fixed inset-0 z-0">
        <img src={arenaBg} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, hsla(220,40%,8%,0.55) 0%, hsla(150,40%,10%,0.7) 60%, hsla(20,50%,8%,0.85) 100%)",
        }} />
      </div>

      {/* Top Bar */}
      <div className="relative z-20 flex items-center justify-between px-3 pt-3">
        <button
          onClick={() => navigate("/")}
          className="h-9 w-9 rounded-full flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, hsl(45 90% 55%), hsl(30 80% 45%))",
            boxShadow: "0 4px 10px hsla(0,0%,0%,0.5), inset 0 1px 0 hsla(0,0%,100%,0.3)",
          }}
        >
          <ArrowLeft className="h-4 w-4" style={{ color: "hsl(0 0% 12%)" }} />
        </button>
        <div className="text-center">
          <h1
            className="font-black text-base leading-tight"
            style={{
              background: "linear-gradient(135deg, hsl(45 95% 70%), hsl(140 70% 60%), hsl(25 90% 60%))",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 2px 4px hsla(0,0%,0%,0.6))",
            }}
          >
            DRAGON vs TIGER
          </h1>
          <p className="text-[9px] -mt-0.5" style={{ color: "hsl(45 60% 75%)" }}>Round #{round}</p>
        </div>
        <button
          onClick={() => setSoundOn((p) => !p)}
          className="h-9 w-9 rounded-full flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, hsl(280 60% 45%), hsl(310 55% 38%))",
            boxShadow: "0 4px 10px hsla(0,0%,0%,0.5), inset 0 1px 0 hsla(0,0%,100%,0.3)",
          }}
        >
          {soundOn ? <Volume2 className="h-4 w-4 text-white" /> : <VolumeX className="h-4 w-4 text-white" />}
        </button>
      </div>

      {/* Wallet & balance pill */}
      <div className="relative z-20 mt-2 px-3 flex items-center justify-center gap-2">
        <button
          onClick={() => { if (phase === "betting" && totalBet === 0) setActiveWallet("dollar"); }}
          className="px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1"
          style={{
            background: activeWallet === "dollar" ? "linear-gradient(135deg, hsl(140 70% 45%), hsl(160 60% 38%))" : "hsla(0,0%,0%,0.4)",
            color: "hsl(0 0% 100%)",
            border: activeWallet === "dollar" ? "1px solid hsl(140 80% 60%)" : "1px solid hsla(255,255%,255%,0.15)",
          }}
        >
          💲 {gameDollar.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </button>
        <button
          onClick={() => { if (phase === "betting" && totalBet === 0) setActiveWallet("star"); }}
          className="px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1"
          style={{
            background: activeWallet === "star" ? "linear-gradient(135deg, hsl(40 90% 50%), hsl(25 85% 45%))" : "hsla(0,0%,0%,0.4)",
            color: activeWallet === "star" ? "hsl(0 0% 12%)" : "hsl(0 0% 100%)",
            border: activeWallet === "star" ? "1px solid hsl(45 95% 65%)" : "1px solid hsla(255,255%,255%,0.15)",
          }}
        >
          ⭐ {gameStar.toLocaleString()}
        </button>
      </div>

      {/* ARENA: dragon | center cards/timer | tiger */}
      <div className="relative z-10 mt-3 px-2">
        <div className="flex items-end justify-between gap-1">
          {/* Dragon mascot — flipped to face center */}
          <motion.img
            src={dragonImg}
            alt="Dragon"
            className="h-32 w-32 object-contain shrink-0"
            style={{
              transform: "scaleX(-1)",
              filter: winner === "dragon"
                ? "drop-shadow(0 0 20px hsl(140 90% 55%)) drop-shadow(0 0 40px hsl(140 80% 50%))"
                : "drop-shadow(0 8px 14px hsla(0,0%,0%,0.7))",
            }}
            animate={
              phase === "dealing" ? { y: [0, -4, 0], scale: [1, 1.05, 1] }
              : winner === "dragon" ? { scale: [1, 1.12, 1.08] }
              : winner && (winner as Side) !== "dragon" ? { scale: 0.85, opacity: 0.55 }
              : { scale: 1, opacity: 1 }
            }
            transition={{ duration: 0.6 }}
            loading="lazy"
            width={128} height={128}
          />

          {/* Center cards + timer */}
          <div className="flex flex-col items-center gap-1 pb-2">
            <div className="flex items-end gap-1.5">
              {renderCard(dragonCard)}
              <div className="flex flex-col items-center">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center font-black text-sm"
                  style={{
                    background: phase === "dealing"
                      ? "linear-gradient(135deg, hsl(0 80% 50%), hsl(25 80% 45%))"
                      : "linear-gradient(135deg, hsl(45 95% 55%), hsl(25 90% 45%))",
                    color: "hsl(0 0% 12%)",
                    boxShadow: "0 4px 12px hsla(0,0%,0%,0.6), inset 0 1px 2px hsla(0,0%,100%,0.5)",
                    border: "2px solid hsl(45 95% 70%)",
                  }}
                >
                  {phase === "dealing" ? "..." : phase === "result" ? resultTimer : "VS"}
                </div>
              </div>
              {renderCard(tigerCard)}
            </div>
            <AnimatePresence>
              {phase === "result" && winner && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-center mt-1"
                >
                  {winAmount > 0 ? (
                    <p className="font-black text-xs" style={{ color: "hsl(50 95% 70%)", textShadow: "0 2px 5px hsla(0,0%,0%,0.7)" }}>
                      🎉 {winner === "tie" ? "TIE!" : winner.toUpperCase() + " WINS"} +{sym}{winAmount}
                    </p>
                  ) : (
                    <p className="font-black text-xs" style={{ color: "hsl(0 80% 70%)" }}>
                      💨 {winner.toUpperCase()} — Lost {sym}{totalLost}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tiger mascot — faces left already */}
          <motion.img
            src={tigerImg}
            alt="Tiger"
            className="h-32 w-32 object-contain shrink-0"
            style={{
              transform: "scaleX(-1)",
              filter: winner === "tiger"
                ? "drop-shadow(0 0 20px hsl(45 95% 60%)) drop-shadow(0 0 40px hsl(25 90% 55%))"
                : "drop-shadow(0 8px 14px hsla(0,0%,0%,0.7))",
            }}
            animate={
              phase === "dealing" ? { y: [0, -4, 0], scale: [1, 1.05, 1] }
              : winner === "tiger" ? { scale: [1, 1.12, 1.08] }
              : winner && (winner as Side) !== "tiger" ? { scale: 0.85, opacity: 0.55 }
              : { scale: 1, opacity: 1 }
            }
            transition={{ duration: 0.6 }}
            loading="lazy"
            width={128} height={128}
          />
        </div>
      </div>

      {/* History strip */}
      <div className="relative z-10 px-3 mt-2">
        <div
          className="rounded-full px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-hide"
          style={{
            background: "hsla(0,0%,0%,0.55)",
            border: "1px solid hsla(45,90%,55%,0.25)",
            backdropFilter: "blur(6px)",
          }}
        >
          {history.length === 0 ? (
            <span className="text-[10px] mx-auto" style={{ color: "hsla(0,0%,100%,0.45)" }}>No history yet</span>
          ) : (
            history.map((h, i) => {
              const c = h === "dragon" ? "hsl(140 75% 45%)" : h === "tiger" ? "hsl(28 90% 52%)" : "hsl(160 70% 50%)";
              const letter = h === "dragon" ? "D" : h === "tiger" ? "T" : "Tie";
              return (
                <div
                  key={i}
                  className="h-6 min-w-[24px] px-1 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                  style={{
                    background: c,
                    color: "hsl(0 0% 100%)",
                    boxShadow: `inset 0 1px 0 hsla(0,0%,100%,0.4), 0 0 8px ${c}77`,
                  }}
                >
                  {letter}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Side leaderboards + bet pads row */}
      <div className="relative z-10 mt-3 px-2 flex gap-1.5 items-stretch">
        {/* Left leaderboard */}
        <div className="flex flex-col gap-1.5 w-[58px] shrink-0">
          <div
            className="text-center text-[9px] font-black py-0.5 rounded"
            style={{ background: "linear-gradient(135deg, hsl(45 90% 55%), hsl(30 85% 45%))", color: "hsl(0 0% 12%)" }}
          >
            WINNER
          </div>
          {SIDE_PLAYERS_LEFT.map((p, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-black"
                style={{
                  background: ["hsl(280 60% 45%)", "hsl(140 60% 40%)", "hsl(210 65% 45%)"][i % 3],
                  color: "hsl(0 0% 100%)",
                  border: "2px solid hsl(45 85% 55%)",
                  boxShadow: "0 4px 8px hsla(0,0%,0%,0.5)",
                }}
              >
                {p.name[0]}
              </div>
              <span className="text-[9px] font-bold leading-none" style={{ color: "hsl(0 0% 95%)" }}>{p.name}</span>
              <span className="text-[8px] leading-none" style={{ color: "hsl(45 70% 70%)" }}>{p.amount}</span>
            </div>
          ))}
        </div>

        {/* Three bet pads */}
        <div className="flex-1 flex gap-1.5">
          <BetPad
            side="dragon"
            title="DRAGON"
            payout="1 : 1"
            poolAmount={pool.dragon}
            accent="hsl(140 80% 55%)"
            bg="linear-gradient(160deg, hsl(150 55% 22%), hsl(160 60% 12%))"
            icon={<img src={dragonImg} alt="" className="h-16 w-16 object-contain" style={{ filter: "drop-shadow(0 4px 8px hsla(140,90%,30%,0.7))" }} loading="lazy" width={64} height={64} />}
          />
          <BetPad
            side="tie"
            title="TIE"
            payout="8 : 1"
            poolAmount={pool.tie}
            accent="hsl(160 75% 55%)"
            bg="linear-gradient(160deg, hsl(180 50% 22%), hsl(190 55% 12%))"
            icon={
              <div className="relative h-16 w-16 flex items-center justify-center">
                <div className="absolute" style={{ transform: "translate(-10px, 4px)" }}>
                  <PokerChip chipDef={CHIPS[3]} size={32} />
                </div>
                <div className="absolute" style={{ transform: "translate(8px, -2px)" }}>
                  <PokerChip chipDef={CHIPS[4]} size={32} />
                </div>
                <div className="absolute" style={{ transform: "translate(-2px, -8px)" }}>
                  <PokerChip chipDef={CHIPS[1]} size={32} />
                </div>
              </div>
            }
          />
          <BetPad
            side="tiger"
            title="TIGER"
            payout="1 : 1"
            poolAmount={pool.tiger}
            accent="hsl(45 95% 60%)"
            bg="linear-gradient(160deg, hsl(30 70% 30%), hsl(20 75% 16%))"
            icon={<img src={tigerImg} alt="" className="h-16 w-16 object-contain" style={{ filter: "drop-shadow(0 4px 8px hsla(25,90%,30%,0.7))" }} loading="lazy" width={64} height={64} />}
          />
        </div>

        {/* Right leaderboard */}
        <div className="flex flex-col gap-1.5 w-[58px] shrink-0">
          <div
            className="text-center text-[9px] font-black py-0.5 rounded"
            style={{ background: "linear-gradient(135deg, hsl(280 65% 50%), hsl(310 60% 45%))", color: "hsl(0 0% 100%)" }}
          >
            LUCKY
          </div>
          {SIDE_PLAYERS_RIGHT.map((p, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-black"
                style={{
                  background: ["hsl(0 65% 50%)", "hsl(45 75% 50%)", "hsl(170 60% 40%)"][i % 3],
                  color: "hsl(0 0% 100%)",
                  border: "2px solid hsl(45 85% 55%)",
                  boxShadow: "0 4px 8px hsla(0,0%,0%,0.5)",
                }}
              >
                {p.name[0]}
              </div>
              <span className="text-[9px] font-bold leading-none" style={{ color: "hsl(0 0% 95%)" }}>{p.name}</span>
              <span className="text-[8px] leading-none" style={{ color: "hsl(45 70% 70%)" }}>{p.amount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chip selector + actions */}
      <div className="relative z-10 mt-3 px-3 pb-4">
        <div
          className="rounded-2xl px-2 py-2 flex items-center gap-1.5"
          style={{
            background: "linear-gradient(180deg, hsla(20,40%,18%,0.85), hsla(15,45%,10%,0.95))",
            border: "1px solid hsla(45,90%,55%,0.3)",
            boxShadow: "0 6px 18px hsla(0,0%,0%,0.55), inset 0 1px 0 hsla(45,90%,55%,0.15)",
          }}
        >
          <div className="flex items-center justify-center gap-1.5 flex-1 overflow-x-auto scrollbar-hide">
            {CHIPS.map((c) => (
              <PokerChip
                key={c.value}
                chipDef={c}
                active={chip === c.value}
                onClick={() => phase === "betting" && setChip(c.value)}
                size={44}
              />
            ))}
          </div>
        </div>

        {/* Action row */}
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={clearBets}
            disabled={phase !== "betting" || totalBet === 0}
            className="px-3 py-2.5 rounded-xl text-xs font-bold"
            style={{
              background: "hsla(0,0%,100%,0.08)",
              color: "hsl(45 70% 75%)",
              border: "1px solid hsla(45,90%,55%,0.25)",
              opacity: phase !== "betting" || totalBet === 0 ? 0.4 : 1,
            }}
          >
            CLEAR
          </button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={deal}
            disabled={phase !== "betting" || totalBet === 0 || currentBalance < totalBet}
            className="flex-1 py-3 rounded-xl font-black text-sm"
            style={{
              background: phase === "betting" && totalBet > 0
                ? "linear-gradient(135deg, hsl(45 95% 55%), hsl(25 90% 50%), hsl(0 80% 50%))"
                : "hsla(0,0%,40%,0.4)",
              color: phase === "betting" && totalBet > 0 ? "hsl(0 0% 12%)" : "hsl(0 0% 60%)",
              boxShadow: phase === "betting" && totalBet > 0
                ? "0 6px 18px hsla(45,90%,40%,0.5), 0 0 25px hsla(0,80%,50%,0.3)" : "none",
            }}
          >
            {phase === "betting"
              ? totalBet > 0 ? `🀄 DEAL — ${sym}${totalBet}` : "PLACE YOUR BET"
              : phase === "dealing" ? "Dealing..." : `Next ${resultTimer}s`}
          </motion.button>

          <button
            onClick={repeatBets}
            disabled={phase !== "betting" || !lastBets}
            className="px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1"
            style={{
              background: "linear-gradient(135deg, hsl(0 70% 45%), hsl(20 70% 40%))",
              color: "hsl(0 0% 100%)",
              border: "1px solid hsl(45 90% 55%)",
              opacity: phase !== "betting" || !lastBets ? 0.4 : 1,
            }}
          >
            <RotateCcw className="h-3 w-3" /> REPEAT
          </button>
        </div>

        {/* Live count badge */}
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <div
            className="px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[10px] font-bold"
            style={{
              background: "hsla(0,0%,0%,0.55)",
              color: "hsl(140 70% 65%)",
              border: "1px solid hsla(140,70%,50%,0.3)",
            }}
          >
            <Users className="h-3 w-3" /> 1,386 playing
          </div>
        </div>
      </div>
    </div>
  );
};

export default DragonTigerGame;
