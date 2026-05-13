import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BookOpen, Users } from "lucide-react";
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
import arenaBg from "@/assets/dragon-tiger/arena-bg.jpg";

type Side = "dragon" | "tiger" | "tie";
type Phase = "betting" | "dealing" | "result";

interface CardData { rank: number; suit: number; }
const SUITS = [
  { s: "♥", color: "hsl(0 80% 48%)" },
  { s: "♦", color: "hsl(0 80% 48%)" },
  { s: "♣", color: "hsl(0 0% 12%)" },
  { s: "♠", color: "hsl(0 0% 12%)" },
];
const RANK_LABELS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

const CHIP_VALUES = [1, 10, 50, 100, 500];

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
  const [resultTimer, setResultTimer] = useState(15);
  const [history, setHistory] = useState<Side[]>(["tiger","dragon","tiger","tie","tie","tiger","tiger","tiger","dragon","dragon","tiger"]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { if (soundOn) startBgMusic(); else stopBgMusic(); return () => stopBgMusic(); }, [soundOn]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Betting countdown — always ticks during betting; auto-deals if bets placed at 0
  useEffect(() => {
    if (phase !== "betting") return;
    const id = setInterval(() => {
      setBetTimer((t) => {
        if (t <= 1) {
          clearInterval(id);
          if (bets.dragon + bets.tiger + bets.tie > 0) deal();
          return 15;
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
    if (phase !== "betting") return;
    if (currentBalance < totalBet + chip) return;
    setBets((p) => ({ ...p, [side]: p[side] + chip }));
    if (soundRef.current) playBetSound();
  };
  const doubleAllBets = () => {
    if (phase !== "betting" || totalBet === 0) return;
    if (currentBalance < totalBet * 2) return;
    setBets((p) => ({ dragon: p.dragon * 2, tiger: p.tiger * 2, tie: p.tie * 2 }));
    if (soundRef.current) playBetSound();
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
    if (activeWallet === "dollar") setLocalDollarAdj((p) => p - totalBet); else setLocalStarAdj((p) => p - totalBet);
    if (soundRef.current) playSpinSound();
    setLastBets(bets);
    setPhase("dealing");
    setDragonCard(null); setTigerCard(null); setWinner(null);

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

    setTimeout(() => { setDragonCard(finalDragon); if (soundRef.current) playResultReveal(); }, 700);
    setTimeout(() => { setTigerCard(finalTiger); if (soundRef.current) playResultReveal(); }, 1500);
    setTimeout(() => {
      let payout = 0;
      if (outcome === "dragon") payout = bets.dragon * 2;
      else if (outcome === "tiger") payout = bets.tiger * 2;
      else payout = bets.tie * 9 + (bets.dragon + bets.tiger) * 0.5;
      payout = Math.round(payout * 100) / 100;
      const profit = payout - totalBet;

      setWinner(outcome);
      setHistory((h) => [outcome, ...h].slice(0, 14));

      if (payout > 0) {
        setWinAmount(payout);
        if (profit > 0 && soundRef.current) playWinSound();
        else if (soundRef.current) playLoseSound();
      } else {
        setWinAmount(0);
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
            setBetTimer(15);
            setPhase("betting");
            return 15;
          }
          return p - 1;
        });
      }, 1000);
    }, 2400);
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
                <div className="font-black text-sm leading-none" style={{ color: SUITS[card.suit].color }}>{RANK_LABELS[card.rank - 1]}</div>
                <div className="text-[10px] leading-none" style={{ color: SUITS[card.suit].color }}>{SUITS[card.suit].s}</div>
              </div>
              <div className="self-center text-xl leading-none" style={{ color: SUITS[card.suit].color }}>{SUITS[card.suit].s}</div>
              <div className="self-end leading-none rotate-180">
                <div className="font-black text-sm leading-none" style={{ color: SUITS[card.suit].color }}>{RANK_LABELS[card.rank - 1]}</div>
                <div className="text-[10px] leading-none" style={{ color: SUITS[card.suit].color }}>{SUITS[card.suit].s}</div>
              </div>
            </>
          )}
        </div>
        <div
          className="absolute inset-0 rounded-md"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: "repeating-linear-gradient(45deg, hsl(0 70% 28%) 0 5px, hsl(0 75% 22%) 5px 10px)",
            border: "1.5px solid hsl(45 90% 55%)",
          }}
        />
      </motion.div>
    </div>
  );

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden flex items-center justify-center"
      style={{
        backgroundImage: `url(${arenaBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "hsl(220 40% 5%)",
      }}
    >
      {/* Full backdrop image — exact reference (kept as sizing anchor, invisible) */}
      <div className="relative w-full mx-auto" style={{ maxWidth: 320 }}>
        <img
          src={arenaBg}
          alt="Dragon vs Tiger arena"
          className="block w-full h-auto select-none pointer-events-none invisible"
          draggable={false}
        />

        {/* TOP BUTTONS overlays */}
        <button
          onClick={() => navigate("/")}
          className="absolute"
          style={{ left: "3%", top: "1.8%", width: "10%", aspectRatio: "1/1" }}
          aria-label="Back"
        >
          <span className="sr-only"><ArrowLeft /></span>
        </button>
        <button
          onClick={() => {}}
          className="absolute"
          style={{ right: "3%", top: "1.8%", width: "10%", aspectRatio: "1/1" }}
          aria-label="Rules"
        >
          <span className="sr-only"><BookOpen /></span>
        </button>

        {/* CARDS overlay — only shown during dealing/result, betting shows painted cards */}
        <div className="absolute" style={{ left: "33%", top: "20.5%", width: "13%", aspectRatio: "5/7", visibility: phase === "betting" ? "hidden" : "visible" }}>
          {renderCard(dragonCard)}
        </div>
        <div className="absolute" style={{ left: "54%", top: "20.5%", width: "13%", aspectRatio: "5/7", visibility: phase === "betting" ? "hidden" : "visible" }}>
          {renderCard(tigerCard)}
        </div>

        {/* Timer disc ABOVE VS — golden crown style, always shows 15s countdown */}
        <div
          className="absolute flex items-center justify-center font-black"
          style={{
            left: "50%", top: "11%", transform: "translateX(-50%)",
            width: "11%", aspectRatio: "1/1",
            background: "radial-gradient(circle, hsla(45,95%,25%,0.98), hsla(0,0%,5%,0.98))",
            borderRadius: "50%",
            color: "hsl(50 95% 70%)",
            border: "2px solid hsl(45 95% 55%)",
            boxShadow: "0 0 18px hsla(45,95%,55%,0.9), inset 0 0 10px hsla(45,95%,55%,0.5)",
            fontSize: 15,
            textShadow: "0 0 6px hsla(45,95%,70%,0.95)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          {phase === "dealing" ? "…" : phase === "result" ? resultTimer : betTimer}
        </div>

        {/* BET PANEL OVERLAYS — Tie / Dragon / Tiger (interactive only) */}
        {/* Tie (top center curved) */}
        <button
          onClick={() => addBet("tie")}
          disabled={phase !== "betting"}
          className="absolute"
          style={{ left: "31%", top: "38.5%", width: "38%", height: "11%", borderRadius: "999px 999px 0 0" }}
        >
          {bets.tie > 0 && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-black"
              style={{ background: "linear-gradient(135deg, hsl(45 95% 60%), hsl(25 90% 50%))", color: "hsl(0 0% 12%)" }}>
              {sym}{bets.tie}
            </div>
          )}
          {phase === "result" && winner === "tie" && (
            <div className="absolute inset-0 rounded-t-full" style={{ boxShadow: "inset 0 0 0 3px hsl(140 80% 55%), 0 0 25px hsl(140 80% 55%)" }} />
          )}
        </button>

        {/* Dragon panel (left) */}
        <button
          onClick={() => addBet("dragon")}
          disabled={phase !== "betting"}
          className="absolute"
          style={{ left: "13%", top: "49%", width: "37%", height: "29%" }}
        >
          {bets.dragon > 0 && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[11px] font-black"
              style={{ background: "linear-gradient(135deg, hsl(45 95% 60%), hsl(25 90% 50%))", color: "hsl(0 0% 12%)", boxShadow: "0 2px 8px hsla(0,0%,0%,0.6)" }}>
              {sym}{bets.dragon}
            </div>
          )}
          {phase === "result" && winner === "dragon" && (
            <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 0 3px hsl(220 90% 60%), 0 0 25px hsl(220 90% 60%)" }} />
          )}
        </button>

        {/* Tiger panel (right) */}
        <button
          onClick={() => addBet("tiger")}
          disabled={phase !== "betting"}
          className="absolute"
          style={{ left: "50%", top: "49%", width: "37%", height: "29%" }}
        >
          {bets.tiger > 0 && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[11px] font-black"
              style={{ background: "linear-gradient(135deg, hsl(45 95% 60%), hsl(25 90% 50%))", color: "hsl(0 0% 12%)", boxShadow: "0 2px 8px hsla(0,0%,0%,0.6)" }}>
              {sym}{bets.tiger}
            </div>
          )}
          {phase === "result" && winner === "tiger" && (
            <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 0 3px hsl(28 95% 55%), 0 0 25px hsl(28 95% 55%)" }} />
          )}
        </button>

        {/* Player count clickable (wallet toggle) */}
        <button
          onClick={() => { if (phase === "betting" && totalBet === 0) setActiveWallet((w) => w === "dollar" ? "star" : "dollar"); }}
          className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black text-white"
          style={{ left: "3%", top: "76%", background: "hsla(0,0%,0%,0.55)", border: "1px solid hsla(45,90%,55%,0.5)" }}
        >
          <Users className="h-3 w-3" /> {sym}{currentBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </button>

        {/* CHIPS overlay — over the painted 1/10/50/100/500 row */}
        <div className="absolute flex items-center justify-between" style={{ left: "8%", right: "8%", top: "82%", height: "8%" }}>
          {CHIP_VALUES.map((v) => (
            <button
              key={v}
              onClick={() => phase === "betting" && setChip(v)}
              className="relative"
              style={{ width: "17%", aspectRatio: "1/1" }}
              aria-label={`Chip ${v}`}
            >
              {chip === v && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: "0 0 0 3px hsl(45 95% 60%), 0 0 18px hsla(45,95%,60%,0.8)" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* BOTTOM BAR overlays: total bet, +, x2 DOUBLE */}
        {/* Total bet display (read-only, repeat trigger on tap of avatar area) */}
        <button
          onClick={repeatBets}
          className="absolute"
          style={{ left: "11%", top: "92.6%", width: "10%", aspectRatio: "1/1", borderRadius: "50%" }}
          aria-label="Repeat last bet"
        />
        <div
          className="absolute flex items-center justify-center font-black text-white"
          style={{ left: "23%", right: "38%", top: "93%", height: "5.5%", fontSize: 16 }}
        >
          {sym}{totalBet.toFixed(2)}
        </div>

        {/* + button → DEAL */}
        <button
          onClick={deal}
          disabled={phase !== "betting" || totalBet === 0 || currentBalance < totalBet}
          className="absolute"
          style={{ left: "65%", top: "92.6%", width: "10%", aspectRatio: "1/1", borderRadius: "50%" }}
          aria-label="Deal cards"
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

        {/* x2 DOUBLE — instantly doubles all current bets */}
        <button
          onClick={doubleAllBets}
          disabled={phase !== "betting" || totalBet === 0 || currentBalance < totalBet * 2}
          className="absolute"
          style={{ right: "8%", top: "92.6%", width: "11%", aspectRatio: "1/1", borderRadius: "50%" }}
          aria-label="Double bet"
        >
          {phase === "betting" && totalBet > 0 && currentBalance >= totalBet * 2 && (
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ boxShadow: "0 0 0 3px hsl(140 80% 50%), 0 0 18px hsla(140,80%,50%,0.9)" }}
            />
          )}
        </button>

        {/* Result message floating */}
        <AnimatePresence>
          {phase === "result" && winner && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-full"
              style={{
                top: "36%",
                background: "hsla(220,30%,5%,0.9)",
                border: "1px solid hsla(45,90%,55%,0.6)",
                zIndex: 10,
              }}
            >
              {winAmount > 0 ? (
                <p className="font-black text-xs whitespace-nowrap" style={{ color: "hsl(50 95% 70%)" }}>
                  🎉 {winner === "tie" ? "TIE!" : winner.toUpperCase() + " WINS"} +{sym}{winAmount}
                </p>
              ) : (
                <p className="font-black text-xs whitespace-nowrap" style={{ color: "hsl(0 80% 70%)" }}>
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
