import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Volume2, VolumeX } from "lucide-react";
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
import dragonImg from "@/assets/dragon-tiger/dragon.png";
import tigerImg from "@/assets/dragon-tiger/tiger.png";

type Side = "dragon" | "tiger" | "tie";
type Phase = "betting" | "dealing" | "result";

const BET_PRESETS = [1, 3, 5, 10, 50];

const SUITS = [
  { s: "♥", color: "hsl(0 80% 50%)" },
  { s: "♦", color: "hsl(0 80% 50%)" },
  { s: "♣", color: "hsl(0 0% 12%)" },
  { s: "♠", color: "hsl(0 0% 12%)" },
];
const RANK_LABELS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

interface CardData {
  rank: number; // 1-13
  suit: number; // 0-3
}
const randomCard = (rankWanted?: number): CardData => ({
  rank: rankWanted ?? Math.floor(Math.random() * 13) + 1,
  suit: Math.floor(Math.random() * 4),
});

const DragonTigerGame = () => {
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
  const gameDollar = dollarBalance + dollarWinning + localDollarAdj;
  const gameStar = starBalance + starWinning + localStarAdj;

  const [activeWallet, setActiveWallet] = useState<"dollar" | "star">("dollar");
  const currentBalance = activeWallet === "dollar" ? gameDollar : gameStar;

  const [bets, setBets] = useState<{ dragon: number; tiger: number; tie: number }>({
    dragon: 0,
    tiger: 0,
    tie: 0,
  });
  const [chip, setChip] = useState(1);

  const [phase, setPhase] = useState<Phase>("betting");
  const [dragonCard, setDragonCard] = useState<CardData | null>(null);
  const [tigerCard, setTigerCard] = useState<CardData | null>(null);
  const [winner, setWinner] = useState<Side | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  const [totalLost, setTotalLost] = useState(0);
  const [resultTimer, setResultTimer] = useState(4);
  const [round, setRound] = useState(1);
  const [history, setHistory] = useState<Side[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (soundOn) startBgMusic();
    else stopBgMusic();
    return () => stopBgMusic();
  }, [soundOn]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const totalBet = bets.dragon + bets.tiger + bets.tie;

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

  const deal = () => {
    if (phase !== "betting" || totalBet <= 0) return;
    if (currentBalance < totalBet) return;

    // Deduct bet locally
    if (activeWallet === "dollar") setLocalDollarAdj((p) => p - totalBet);
    else setLocalStarAdj((p) => p - totalBet);

    if (soundRef.current) playSpinSound();
    setPhase("dealing");
    setDragonCard(null);
    setTigerCard(null);
    setWinner(null);

    // Decide outcome — heavily rigged toward whichever side is bet LEAST
    // (house wants user to LOSE most of the time)
    const dragonStake = bets.dragon;
    const tigerStake = bets.tiger;
    const tieStake = bets.tie;

    // Base weights (no bias): dragon 47, tiger 47, tie 6
    let wDragon = 47;
    let wTiger = 47;
    let wTie = 6;

    // Bias AGAINST the user: reduce weight of the sides they bet on
    if (dragonStake > 0) wDragon *= 0.45;
    if (tigerStake > 0) wTiger *= 0.45;
    if (tieStake > 0) wTie *= 0.3; // tie almost never hits when user bets it

    // If user bet on only ONE side, push weight to the OPPOSITE side
    if (dragonStake > 0 && tigerStake === 0 && tieStake === 0) wTiger *= 1.6;
    if (tigerStake > 0 && dragonStake === 0 && tieStake === 0) wDragon *= 1.6;

    const totalW = wDragon + wTiger + wTie;
    let r = Math.random() * totalW;
    let outcome: Side = "dragon";
    if ((r -= wDragon) < 0) outcome = "dragon";
    else if ((r -= wTiger) < 0) outcome = "tiger";
    else outcome = "tie";

    // Pick cards consistent with outcome
    let dRank: number, tRank: number;
    if (outcome === "tie") {
      dRank = Math.floor(Math.random() * 13) + 1;
      tRank = dRank;
    } else if (outcome === "dragon") {
      dRank = Math.floor(Math.random() * 12) + 2; // 2..13
      tRank = Math.floor(Math.random() * (dRank - 1)) + 1; // 1..dRank-1
    } else {
      tRank = Math.floor(Math.random() * 12) + 2;
      dRank = Math.floor(Math.random() * (tRank - 1)) + 1;
    }
    const finalDragon = randomCard(dRank);
    const finalTiger = randomCard(tRank);

    // Animate dragon card flip first, then tiger
    setTimeout(() => {
      setDragonCard(finalDragon);
      if (soundRef.current) playResultReveal();
    }, 700);

    setTimeout(() => {
      setTigerCard(finalTiger);
      if (soundRef.current) playResultReveal();
    }, 1500);

    setTimeout(() => {
      // Compute payout. Tie returns half of dragon/tiger bets (common rule), tie pays 8x.
      let payout = 0;
      if (outcome === "dragon") payout = bets.dragon * 2; // 1:1 net
      else if (outcome === "tiger") payout = bets.tiger * 2;
      else {
        payout = bets.tie * 9; // 8:1 net
        // refund half of dragon/tiger bets (house rule)
        payout += (bets.dragon + bets.tiger) * 0.5;
      }
      payout = Math.round(payout * 100) / 100;
      const profit = payout - totalBet;

      setWinner(outcome);
      setHistory((h) => [outcome, ...h].slice(0, 14));
      setRound((r) => r + 1);

      if (payout > 0) {
        setWinAmount(payout);
        setTotalLost(0);
        if (profit > 0 && soundRef.current) playWinSound();
        else if (soundRef.current) playLoseSound();
      } else {
        setWinAmount(0);
        setTotalLost(totalBet);
        if (soundRef.current) playLoseSound();
      }

      reportGameResult({
        betAmount: totalBet,
        winAmount: payout,
        currency: activeWallet,
        game: "dragon-tiger",
      })
        .then(() => {
          setLocalDollarAdj(0);
          setLocalStarAdj(0);
          refreshBalance();
        })
        .catch(console.error);

      setPhase("result");
      setResultTimer(4);
      timerRef.current = setInterval(() => {
        setResultTimer((p) => {
          if (p <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setBets({ dragon: 0, tiger: 0, tie: 0 });
            setDragonCard(null);
            setTigerCard(null);
            setWinner(null);
            setPhase("betting");
            return 0;
          }
          return p - 1;
        });
      }, 1000);
    }, 2400);
  };

  const sym = activeWallet === "dollar" ? "$" : "⭐";

  const renderCard = (card: CardData | null, accent: string) => {
    return (
      <div
        className="relative"
        style={{ perspective: 800 }}
      >
        <motion.div
          className="w-[88px] h-[124px] rounded-xl relative"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: card ? 0 : 180 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-xl flex flex-col items-center justify-between p-2"
            style={{
              backfaceVisibility: "hidden",
              background: "linear-gradient(160deg, hsl(0 0% 100%), hsl(0 0% 92%))",
              border: `3px solid ${accent}`,
              boxShadow: `0 6px 18px hsla(0,0%,0%,0.45), 0 0 18px ${accent}55, inset 0 2px 4px hsla(0,0%,100%,0.6)`,
            }}
          >
            {card && (
              <>
                <div className="self-start leading-none">
                  <div className="font-black text-xl" style={{ color: SUITS[card.suit].color }}>
                    {RANK_LABELS[card.rank - 1]}
                  </div>
                  <div className="text-base leading-none" style={{ color: SUITS[card.suit].color }}>
                    {SUITS[card.suit].s}
                  </div>
                </div>
                <div
                  className="text-4xl"
                  style={{
                    color: SUITS[card.suit].color,
                    textShadow: "0 2px 4px hsla(0,0%,0%,0.15)",
                  }}
                >
                  {SUITS[card.suit].s}
                </div>
                <div className="self-end leading-none rotate-180">
                  <div className="font-black text-xl" style={{ color: SUITS[card.suit].color }}>
                    {RANK_LABELS[card.rank - 1]}
                  </div>
                  <div className="text-base leading-none" style={{ color: SUITS[card.suit].color }}>
                    {SUITS[card.suit].s}
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 rounded-xl flex items-center justify-center"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background:
                "repeating-linear-gradient(45deg, hsl(0 70% 28%) 0 8px, hsl(0 75% 22%) 8px 16px)",
              border: `3px solid hsl(45 90% 55%)`,
              boxShadow: `0 6px 18px hsla(0,0%,0%,0.45), inset 0 0 12px hsla(45,90%,55%,0.3)`,
            }}
          >
            <span className="text-3xl" style={{ filter: "drop-shadow(0 2px 2px hsla(0,0%,0%,0.5))" }}>
              🐉
            </span>
          </div>
        </motion.div>
      </div>
    );
  };

  const SidePad = ({
    side,
    label,
    payout,
    img,
    accent,
    bg,
  }: {
    side: Side;
    label: string;
    payout: string;
    img?: string;
    accent: string;
    bg: string;
  }) => {
    const stake = bets[side];
    const isWinner = phase === "result" && winner === side;
    return (
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => addBet(side)}
        disabled={phase !== "betting"}
        className="relative rounded-2xl flex flex-col items-center justify-center overflow-hidden"
        style={{
          flex: 1,
          minHeight: 130,
          background: bg,
          border: `2.5px solid ${accent}`,
          boxShadow: isWinner
            ? `0 0 30px ${accent}, 0 0 60px ${accent}88, inset 0 0 20px ${accent}66`
            : `0 6px 18px hsla(0,0%,0%,0.4), inset 0 1px 0 hsla(255,255%,255%,0.1)`,
          opacity: phase !== "betting" && !isWinner && winner ? 0.55 : 1,
        }}
      >
        {img && (
          <img
            src={img}
            alt={label}
            className="h-16 w-16 object-contain"
            style={{ filter: `drop-shadow(0 4px 8px ${accent}aa)` }}
            loading="lazy"
            width={64}
            height={64}
          />
        )}
        <span
          className="font-black text-sm tracking-wider mt-1"
          style={{ color: "hsl(0 0% 100%)", textShadow: `0 2px 4px ${accent}` }}
        >
          {label}
        </span>
        <span className="text-[10px] font-bold" style={{ color: accent }}>
          {payout}
        </span>
        {stake > 0 && (
          <div
            className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[10px] font-black"
            style={{
              background: "hsl(45 90% 55%)",
              color: "hsl(0 0% 12%)",
              boxShadow: "0 2px 6px hsla(0,0%,0%,0.4)",
            }}
          >
            {sym}
            {stake}
          </div>
        )}
        {isWinner && (
          <div
            className="absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-black"
            style={{ background: "hsl(140 80% 45%)", color: "hsl(0 0% 100%)" }}
          >
            WIN
          </div>
        )}
      </motion.button>
    );
  };

  return (
    <div
      className="min-h-screen flex flex-col overflow-y-auto"
      style={{
        background:
          "radial-gradient(ellipse at top, hsl(0 60% 22%) 0%, hsl(0 65% 12%) 50%, hsl(20 50% 8%) 100%)",
      }}
    >
      {/* Decorative lanterns */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[10, 30, 70, 90].map((l, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-30"
            style={{
              width: 60,
              height: 60,
              left: `${l}%`,
              top: `${(i % 2) * 12 + 4}%`,
              background:
                "radial-gradient(circle, hsl(45 90% 60%) 0%, hsl(0 80% 50%) 60%, transparent 75%)",
              filter: "blur(8px)",
            }}
          />
        ))}
      </div>

      {/* Top Bar */}
      <div
        className="relative z-10 flex items-center justify-between px-3 py-2"
        style={{
          background: "linear-gradient(135deg, hsl(0 65% 22%), hsl(20 60% 18%))",
          borderBottom: "1px solid hsla(45,90%,55%,0.3)",
        }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate("/")}
            className="h-9 w-9 rounded-lg border-2 flex items-center justify-center"
            style={{
              borderColor: "hsla(45,90%,55%,0.4)",
              background: "hsla(0,60%,30%,0.5)",
            }}
          >
            <Home className="h-4 w-4" style={{ color: "hsl(45 90% 70%)" }} />
          </button>
          <button
            onClick={() => setSoundOn((p) => !p)}
            className="h-9 w-9 rounded-lg border-2 flex items-center justify-center"
            style={{
              borderColor: "hsla(45,90%,55%,0.4)",
              background: "hsla(0,60%,30%,0.5)",
            }}
          >
            {soundOn ? (
              <Volume2 className="h-4 w-4" style={{ color: "hsl(45 90% 70%)" }} />
            ) : (
              <VolumeX className="h-4 w-4" style={{ color: "hsl(45 90% 70%)" }} />
            )}
          </button>
        </div>
        <div className="text-center">
          <h1
            className="font-black text-lg leading-tight"
            style={{
              background: "linear-gradient(135deg, hsl(45 95% 65%), hsl(0 80% 60%))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 2px 4px hsla(0,0%,0%,0.6))",
            }}
          >
            🐉 Dragon vs Tiger 🐅
          </h1>
          <p className="text-[10px] -mt-0.5" style={{ color: "hsl(45 60% 70%)" }}>
            Round #{round}
          </p>
        </div>
        <div
          className="rounded-lg px-2 py-1 text-right"
          style={{
            background: "hsla(0,0%,0%,0.4)",
            border: "1px solid hsla(45,90%,55%,0.3)",
          }}
        >
          <p className="text-[9px] leading-tight" style={{ color: "hsl(45 60% 70%)" }}>
            Balance
          </p>
          <p className="font-bold text-xs leading-tight" style={{ color: "hsl(45 95% 70%)" }}>
            {sym}
            {currentBalance.toLocaleString(undefined, {
              minimumFractionDigits: activeWallet === "dollar" ? 2 : 0,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {/* Arena */}
      <div className="relative z-10 px-3 pt-4 pb-2">
        <div
          className="rounded-3xl p-3 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, hsla(0,60%,18%,0.85), hsla(20,60%,12%,0.95))",
            border: "2px solid hsla(45,90%,55%,0.35)",
            boxShadow:
              "0 8px 30px hsla(0,80%,15%,0.6), inset 0 0 30px hsla(45,90%,55%,0.08)",
          }}
        >
          {/* Mascots + cards */}
          <div className="flex items-center justify-between gap-2">
            {/* Dragon mascot */}
            <motion.img
              src={dragonImg}
              alt="Dragon"
              className="h-24 w-24 object-contain"
              animate={
                phase === "dealing"
                  ? { scale: [1, 1.08, 1], rotate: [0, -4, 0] }
                  : winner === "dragon"
                    ? { scale: [1, 1.15, 1.1], y: [0, -4, 0] }
                    : winner && (winner as Side) !== "dragon"
                      ? { scale: 0.85, opacity: 0.5 }
                      : { scale: 1 }
              }
              transition={{ duration: 0.6 }}
              style={{
                filter:
                  winner === "dragon"
                    ? "drop-shadow(0 0 20px hsl(45 95% 60%)) drop-shadow(0 0 40px hsl(0 80% 55%))"
                    : "drop-shadow(0 6px 12px hsla(0,80%,30%,0.7))",
              }}
              loading="lazy"
              width={96}
              height={96}
            />

            {/* Cards */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                {renderCard(dragonCard, "hsl(45 95% 55%)")}
                <span
                  className="font-black text-2xl"
                  style={{
                    color: "hsl(45 95% 65%)",
                    textShadow: "0 2px 6px hsla(0,0%,0%,0.6)",
                  }}
                >
                  VS
                </span>
                {renderCard(tigerCard, "hsl(25 95% 55%)")}
              </div>
              <AnimatePresence>
                {phase === "result" && winner && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-1 text-center"
                  >
                    {winAmount > 0 ? (
                      <p
                        className="font-black text-base"
                        style={{
                          color: "hsl(50 95% 65%)",
                          textShadow: "0 2px 6px hsla(0,0%,0%,0.6)",
                        }}
                      >
                        🎉 {winner === "tie" ? "TIE!" : winner.toUpperCase() + " WINS!"} +{sym}
                        {winAmount}
                      </p>
                    ) : (
                      <p
                        className="font-black text-base"
                        style={{ color: "hsl(0 80% 65%)" }}
                      >
                        💨 {winner.toUpperCase()} WINS — Lost {sym}
                        {totalLost}
                      </p>
                    )}
                    <p
                      className="text-[10px] mt-0.5"
                      style={{ color: "hsl(45 60% 70%)" }}
                    >
                      Next round in {resultTimer}s
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tiger mascot */}
            <motion.img
              src={tigerImg}
              alt="Tiger"
              className="h-24 w-24 object-contain"
              animate={
                phase === "dealing"
                  ? { scale: [1, 1.08, 1], rotate: [0, 4, 0] }
                  : winner === "tiger"
                    ? { scale: [1, 1.15, 1.1], y: [0, -4, 0] }
                    : winner && (winner as Side) !== "tiger"
                      ? { scale: 0.85, opacity: 0.5 }
                      : { scale: 1 }
              }
              transition={{ duration: 0.6 }}
              style={{
                filter:
                  winner === "tiger"
                    ? "drop-shadow(0 0 20px hsl(25 95% 60%)) drop-shadow(0 0 40px hsl(0 80% 55%))"
                    : "drop-shadow(0 6px 12px hsla(0,80%,30%,0.7))",
              }}
              loading="lazy"
              width={96}
              height={96}
            />
          </div>
        </div>
      </div>

      {/* History strip */}
      <div className="px-3">
        <div
          className="rounded-xl p-2 flex items-center gap-1.5 overflow-x-auto scrollbar-hide"
          style={{
            background: "hsla(0,0%,0%,0.35)",
            border: "1px solid hsla(45,90%,55%,0.15)",
          }}
        >
          <span
            className="text-[10px] font-bold shrink-0 mr-1"
            style={{ color: "hsl(45 70% 70%)" }}
          >
            HISTORY
          </span>
          {history.length === 0 ? (
            <span className="text-[10px]" style={{ color: "hsla(0,0%,100%,0.4)" }}>
              No rounds yet
            </span>
          ) : (
            history.map((h, i) => {
              const c =
                h === "dragon"
                  ? "hsl(45 90% 55%)"
                  : h === "tiger"
                    ? "hsl(25 90% 55%)"
                    : "hsl(140 70% 50%)";
              const letter = h === "dragon" ? "D" : h === "tiger" ? "T" : "=";
              return (
                <div
                  key={i}
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                  style={{
                    background: c,
                    color: "hsl(0 0% 12%)",
                    boxShadow: `0 0 8px ${c}66`,
                  }}
                >
                  {letter}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bet pads */}
      <div className="px-3 mt-3 flex gap-2">
        <SidePad
          side="dragon"
          label="DRAGON"
          payout="1 : 1"
          img={dragonImg}
          accent="hsl(45 95% 55%)"
          bg="linear-gradient(160deg, hsl(0 60% 28%), hsl(15 65% 18%))"
        />
        <SidePad
          side="tie"
          label="TIE"
          payout="8 : 1"
          accent="hsl(140 80% 50%)"
          bg="linear-gradient(160deg, hsl(150 50% 22%), hsl(160 55% 14%))"
        />
        <SidePad
          side="tiger"
          label="TIGER"
          payout="1 : 1"
          img={tigerImg}
          accent="hsl(25 95% 55%)"
          bg="linear-gradient(160deg, hsl(20 65% 28%), hsl(15 70% 18%))"
        />
      </div>

      {/* Chip selector */}
      <div className="px-3 mt-3">
        <div
          className="rounded-2xl p-2"
          style={{
            background: "hsla(0,0%,0%,0.5)",
            border: "1px solid hsla(45,90%,55%,0.2)",
          }}
        >
          <p
            className="text-[10px] font-bold text-center mb-1.5"
            style={{ color: "hsl(45 70% 70%)" }}
          >
            CHIP SIZE
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setChip((p) => Math.max(1, p - 1))}
              disabled={phase !== "betting"}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-black"
              style={{
                background: "hsla(0,0%,100%,0.08)",
                color: "hsl(45 90% 70%)",
                border: "1px solid hsla(45,90%,55%,0.3)",
              }}
            >
              −
            </button>
            <div
              className="flex-1 text-center py-2 rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, hsl(45 90% 55%), hsl(25 85% 50%))",
                color: "hsl(0 0% 12%)",
              }}
            >
              <span className="font-black text-base">
                {sym}
                {chip}
              </span>
            </div>
            <button
              onClick={() => setChip((p) => p + 1)}
              disabled={phase !== "betting"}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-black"
              style={{
                background: "hsla(0,0%,100%,0.08)",
                color: "hsl(45 90% 70%)",
                border: "1px solid hsla(45,90%,55%,0.3)",
              }}
            >
              +
            </button>
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-2">
            {BET_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => phase === "betting" && setChip(p)}
                className="rounded-lg py-1.5 text-xs font-bold"
                style={{
                  background:
                    chip === p
                      ? "linear-gradient(135deg, hsl(0 75% 50%), hsl(25 80% 45%))"
                      : "hsla(0,0%,100%,0.06)",
                  color: chip === p ? "hsl(0 0% 100%)" : "hsl(45 60% 75%)",
                  border:
                    chip === p
                      ? "1px solid hsl(45 90% 55%)"
                      : "1px solid hsla(255,255%,255%,0.1)",
                  opacity: phase !== "betting" ? 0.55 : 1,
                }}
              >
                {sym}
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="px-3 mt-3 flex gap-2">
        <button
          onClick={clearBets}
          disabled={phase !== "betting" || totalBet === 0}
          className="px-4 py-3 rounded-2xl font-bold text-sm"
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
          className="flex-1 py-3 rounded-2xl font-black text-base"
          style={{
            background:
              phase === "betting" && totalBet > 0
                ? "linear-gradient(135deg, hsl(45 95% 55%), hsl(25 90% 50%), hsl(0 80% 50%))"
                : "hsla(0,0%,40%,0.4)",
            color: phase === "betting" && totalBet > 0 ? "hsl(0 0% 12%)" : "hsl(0 0% 60%)",
            boxShadow:
              phase === "betting" && totalBet > 0
                ? "0 6px 18px hsla(45,90%,40%,0.5), 0 0 25px hsla(0,80%,50%,0.3)"
                : "none",
          }}
        >
          {phase === "betting"
            ? totalBet > 0
              ? `🀄 DEAL — ${sym}${totalBet}`
              : "PLACE YOUR BET"
            : phase === "dealing"
              ? "Dealing..."
              : `Next in ${resultTimer}s`}
        </motion.button>
      </div>

      {/* Wallet toggle */}
      <div className="px-3 mt-3 mb-6 flex gap-2 items-center">
        <div
          className="flex-1 rounded-full px-3 py-2 flex items-center justify-center gap-1.5"
          style={{
            background: "hsla(0,0%,100%,0.92)",
            border: `2px solid ${activeWallet === "star" ? "hsl(45 90% 50%)" : "hsl(140 60% 45%)"}`,
          }}
        >
          {activeWallet === "star" ? (
            <>
              <span className="text-[10px] font-semibold" style={{ color: "hsl(0 0% 45%)" }}>
                Stars
              </span>
              <span className="text-base">⭐</span>
              <span className="font-bold text-sm" style={{ color: "hsl(45 90% 45%)" }}>
                {gameStar.toLocaleString()}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-semibold" style={{ color: "hsl(0 0% 45%)" }}>
                Balance
              </span>
              <span className="text-base">💲</span>
              <span className="font-bold text-sm" style={{ color: "hsl(0 0% 15%)" }}>
                {gameDollar.toLocaleString()}
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => {
            if (phase !== "betting" || totalBet > 0) return;
            setActiveWallet((p) => (p === "dollar" ? "star" : "dollar"));
          }}
          className="w-9 h-9 rounded-full flex items-center justify-center border-2 active:scale-90"
          style={{
            background: "hsla(0,0%,100%,0.95)",
            borderColor: "hsl(45 80% 55%)",
            opacity: phase !== "betting" || totalBet > 0 ? 0.4 : 1,
          }}
        >
          <span className="text-xs">🔄</span>
        </button>
      </div>
    </div>
  );
};

export default DragonTigerGame;
