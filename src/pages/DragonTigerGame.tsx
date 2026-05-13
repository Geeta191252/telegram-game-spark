import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Volume2, VolumeX, RotateCcw } from "lucide-react";
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

const CHIP_VALUES = [1, 10, 50, 100, 500, 1000];

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
  const [resultTimer, setResultTimer] = useState(15);
  const [round, setRound] = useState(1);
  const [history, setHistory] = useState<Side[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { if (soundOn) startBgMusic(); else stopBgMusic(); return () => stopBgMusic(); }, [soundOn]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const totalBet = bets.dragon + bets.tiger + bets.tie;
  const sym = activeWallet === "dollar" ? "$" : "⭐";

  const addBet = (side: Side) => {
    if (phase !== "betting") return;
    if (currentBalance < totalBet + chip) return;
    setBets((p) => ({ ...p, [side]: p[side] + chip }));
    if (soundRef.current) playBetSound();
  };
  const clearBets = () => { if (phase === "betting") setBets({ dragon: 0, tiger: 0, tie: 0 }); };
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
            return 15;
          }
          return p - 1;
        });
      }, 1000);
    }, 2400);
  };

  // Floating playing card
  const renderCard = (card: CardData | null) => (
    <div style={{ perspective: 800 }}>
      <motion.div
        className="relative"
        style={{ transformStyle: "preserve-3d", width: "100%", aspectRatio: "5 / 7" }}
        animate={{ rotateY: card ? 0 : 180 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
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

  // Poker chip
  const PokerChip = ({ value, active, onClick, size = 44 }: { value: number; active?: boolean; onClick?: () => void; size?: number }) => {
    const palette: Record<number, { inner: string; outer: string; text: string }> = {
      1:    { inner: "hsl(45 30% 95%)", outer: "hsl(40 30% 70%)", text: "hsl(0 0% 20%)" },
      10:   { inner: "hsl(140 70% 40%)", outer: "hsl(140 60% 25%)", text: "hsl(0 0% 100%)" },
      50:   { inner: "hsl(210 80% 50%)", outer: "hsl(215 75% 30%)", text: "hsl(0 0% 100%)" },
      100:  { inner: "hsl(280 65% 50%)", outer: "hsl(285 60% 32%)", text: "hsl(0 0% 100%)" },
      500:  { inner: "hsl(28 90% 52%)",  outer: "hsl(20 85% 32%)",  text: "hsl(0 0% 100%)" },
      1000: { inner: "hsl(0 75% 50%)",   outer: "hsl(0 70% 30%)",   text: "hsl(0 0% 100%)" },
    };
    const p = palette[value];
    const label = value >= 1000 ? `${value / 1000}K` : `${value}`;
    return (
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        className="relative shrink-0"
        style={{ width: size, height: size }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: p.outer,
            boxShadow: active
              ? `0 0 0 3px hsl(45 95% 60%), 0 6px 14px hsla(0,0%,0%,0.65)`
              : `0 4px 10px hsla(0,0%,0%,0.55), inset 0 -3px 0 hsla(0,0%,0%,0.35)`,
          }}
        />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <div
            key={deg}
            className="absolute top-1/2 left-1/2 rounded-sm"
            style={{
              width: size * 0.12, height: size * 0.18,
              background: "hsl(0 0% 96%)",
              transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-${size * 0.42}px)`,
              opacity: 0.85,
            }}
          />
        ))}
        <div
          className="absolute rounded-full flex items-center justify-center"
          style={{
            inset: size * 0.18,
            background: `radial-gradient(circle at 35% 30%, ${p.inner}, ${p.outer})`,
            boxShadow: "inset 0 2px 3px hsla(0,0%,100%,0.4), inset 0 -2px 3px hsla(0,0%,0%,0.3)",
            border: `1px dashed ${p.text}33`,
          }}
        >
          <span className="font-black" style={{ color: p.text, fontSize: size * 0.32, textShadow: "0 1px 1px hsla(0,0%,0%,0.4)" }}>
            {label}
          </span>
        </div>
      </motion.button>
    );
  };

  // Bet panel overlay
  const PanelOverlay = ({ side, color }: { side: Side; color: string }) => {
    const stake = bets[side];
    const isWinner = phase === "result" && winner === side;
    return (
      <button
        onClick={() => addBet(side)}
        disabled={phase !== "betting"}
        className="absolute rounded-[14px] transition-all"
        style={{
          inset: 0,
          background: isWinner
            ? `radial-gradient(circle, ${color}55, transparent 70%)`
            : "transparent",
          boxShadow: isWinner
            ? `inset 0 0 0 3px ${color}, 0 0 30px ${color}aa`
            : "none",
        }}
      >
        {stake > 0 && (
          <div
            className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[11px] font-black"
            style={{
              background: "linear-gradient(135deg, hsl(45 95% 60%), hsl(25 90% 50%))",
              color: "hsl(0 0% 12%)",
              boxShadow: "0 2px 8px hsla(0,0%,0%,0.6)",
            }}
          >
            {sym}{stake}
          </div>
        )}
        {isWinner && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute bottom-1.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-black"
            style={{ background: "hsl(140 80% 45%)", color: "white" }}
          >
            WIN
          </motion.div>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, hsl(220 40% 8%), hsl(20 40% 8%))" }}>
      {/* Top Bar */}
      <div className="relative z-20 flex items-center justify-between px-3 pt-3 pb-2">
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

      {/* Wallet pills */}
      <div className="relative z-20 px-3 flex items-center justify-center gap-2 pb-2">
        <button
          onClick={() => { if (phase === "betting" && totalBet === 0) setActiveWallet("dollar"); }}
          className="px-3 py-1 rounded-full text-[11px] font-bold"
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
          className="px-3 py-1 rounded-full text-[11px] font-bold"
          style={{
            background: activeWallet === "star" ? "linear-gradient(135deg, hsl(40 90% 50%), hsl(25 85% 45%))" : "hsla(0,0%,0%,0.4)",
            color: activeWallet === "star" ? "hsl(0 0% 12%)" : "hsl(0 0% 100%)",
            border: activeWallet === "star" ? "1px solid hsl(45 95% 65%)" : "1px solid hsla(255,255%,255%,0.15)",
          }}
        >
          ⭐ {gameStar.toLocaleString()}
        </button>
      </div>

      {/* ARENA — reference image as full backdrop, controls overlaid at exact positions */}
      <div className="relative w-full" style={{ aspectRatio: "980 / 509" }}>
        <img
          src={arenaBg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(1.05) saturate(1.05)" }}
        />

        {/* CARDS + TIMER overlay (top center) */}
        <div className="absolute" style={{ left: "33%", right: "33%", top: "3%", height: "26%" }}>
          <div className="flex items-center justify-between gap-1 h-full">
            <div style={{ width: "38%" }}>{renderCard(dragonCard)}</div>
            <div className="flex flex-col items-center" style={{ width: "24%" }}>
              <div
                className="rounded-full flex items-center justify-center font-black"
                style={{
                  width: "100%", aspectRatio: "1/1", maxWidth: 44,
                  background: phase === "dealing"
                    ? "linear-gradient(135deg, hsl(0 80% 50%), hsl(25 80% 45%))"
                    : "linear-gradient(135deg, hsl(45 95% 55%), hsl(25 90% 45%))",
                  color: "hsl(0 0% 12%)",
                  boxShadow: "0 4px 12px hsla(0,0%,0%,0.6), inset 0 1px 2px hsla(0,0%,100%,0.5)",
                  border: "2px solid hsl(45 95% 70%)",
                  fontSize: 13,
                }}
              >
                {phase === "dealing" ? "..." : phase === "result" ? resultTimer : "VS"}
              </div>
            </div>
            <div style={{ width: "38%" }}>{renderCard(tigerCard)}</div>
          </div>
        </div>

        {/* HISTORY strip (just above bet panels) */}
        <div className="absolute" style={{ left: "20%", right: "20%", top: "33%" }}>
          <div
            className="rounded-full px-2 py-1 flex items-center gap-1 overflow-hidden"
            style={{
              background: "hsla(220,30%,8%,0.65)",
              border: "1px solid hsla(45,90%,55%,0.3)",
              backdropFilter: "blur(4px)",
            }}
          >
            {history.length === 0 ? (
              <span className="text-[9px] mx-auto" style={{ color: "hsla(0,0%,100%,0.55)" }}>No history yet</span>
            ) : (
              history.slice(0, 11).map((h, i) => {
                const c = h === "dragon" ? "hsl(140 75% 45%)" : h === "tiger" ? "hsl(28 90% 52%)" : "hsl(160 70% 50%)";
                const letter = h === "dragon" ? "D" : h === "tiger" ? "T" : "Tie";
                return (
                  <div
                    key={i}
                    className="rounded-full flex items-center justify-center text-[8px] font-black shrink-0"
                    style={{
                      width: 18, height: 18,
                      background: c,
                      color: "hsl(0 0% 100%)",
                      boxShadow: `inset 0 1px 0 hsla(0,0%,100%,0.4), 0 0 6px ${c}77`,
                    }}
                  >
                    {letter}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* BET PANEL OVERLAYS — positioned to match the painted Dragon / Tie / Tiger panels */}
        <div className="absolute" style={{ left: "13.5%", top: "40%", width: "23%", height: "47%" }}>
          <PanelOverlay side="dragon" color="hsl(140 80% 55%)" />
        </div>
        <div className="absolute" style={{ left: "39%", top: "40%", width: "22%", height: "47%" }}>
          <PanelOverlay side="tie" color="hsl(160 80% 55%)" />
        </div>
        <div className="absolute" style={{ left: "63.5%", top: "40%", width: "23%", height: "47%" }}>
          <PanelOverlay side="tiger" color="hsl(45 95% 60%)" />
        </div>

        {/* Result message */}
        <AnimatePresence>
          {phase === "result" && winner && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-full"
              style={{
                top: "30%",
                background: "hsla(220,30%,5%,0.85)",
                border: "1px solid hsla(45,90%,55%,0.5)",
              }}
            >
              {winAmount > 0 ? (
                <p className="font-black text-xs whitespace-nowrap" style={{ color: "hsl(50 95% 70%)" }}>
                  🎉 {winner === "tie" ? "TIE!" : winner.toUpperCase() + " WINS"} +{sym}{winAmount}
                </p>
              ) : (
                <p className="font-black text-xs whitespace-nowrap" style={{ color: "hsl(0 80% 70%)" }}>
                  💨 {winner.toUpperCase()} — Lost {sym}{totalLost}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chip selector + actions (below arena) */}
      <div className="px-3 pt-3 pb-4">
        <div
          className="rounded-2xl px-2 py-2 flex items-center justify-center gap-1.5"
          style={{
            background: "linear-gradient(180deg, hsla(20,40%,18%,0.85), hsla(15,45%,10%,0.95))",
            border: "1px solid hsla(45,90%,55%,0.3)",
            boxShadow: "0 6px 18px hsla(0,0%,0%,0.55), inset 0 1px 0 hsla(45,90%,55%,0.15)",
          }}
        >
          {CHIP_VALUES.map((v) => (
            <PokerChip
              key={v}
              value={v}
              active={chip === v}
              onClick={() => phase === "betting" && setChip(v)}
              size={44}
            />
          ))}
        </div>

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
      </div>
    </div>
  );
};

export default DragonTigerGame;
