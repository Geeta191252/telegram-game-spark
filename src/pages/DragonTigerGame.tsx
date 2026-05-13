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
  const [history, setHistory] = useState<Side[]>(["dragon","tiger","tiger","tiger","tiger","tiger","dragon","tiger","dragon","dragon"]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const latestRoundRef = useRef({ phase, bets, activeWallet, currentBalance });
  latestRoundRef.current = { phase, bets, activeWallet, currentBalance };

  const clearRoundTimeouts = () => {
    roundTimeoutsRef.current.forEach(clearTimeout);
    roundTimeoutsRef.current = [];
  };

  useEffect(() => { if (soundOn) startBgMusic(); else stopBgMusic(); return () => stopBgMusic(); }, [soundOn]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); clearRoundTimeouts(); }, []);

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
    const snapshot = latestRoundRef.current;
    const roundBets = snapshot.bets;
    const roundTotalBet = roundBets.dragon + roundBets.tiger + roundBets.tie;
    const roundWallet = snapshot.activeWallet;
    if (snapshot.phase !== "betting") return;
    if (roundTotalBet > 0 && snapshot.currentBalance < roundTotalBet) return;
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
        <img
          src={arenaBg}
          alt="Dragon vs Tiger arena"
          className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
          draggable={false}
        />

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
          @keyframes dt-fire-blast-r {
            0% { transform: translate(-50%, -50%) scaleX(0) scaleY(0.4); opacity: 0; filter: blur(8px) hue-rotate(0deg); }
            15% { opacity: 1; }
            40% { transform: translate(-50%, -50%) scaleX(1) scaleY(1.1); filter: blur(0px) hue-rotate(-10deg); }
            70% { transform: translate(-50%, -50%) scaleX(1.05) scaleY(1); opacity: 1; filter: blur(1px) hue-rotate(10deg); }
            100% { transform: translate(-50%, -50%) scaleX(1.1) scaleY(0.9); opacity: 0; filter: blur(6px); }
          }
          @keyframes dt-fire-blast-l {
            0% { transform: translate(-50%, -50%) scaleX(0) scaleY(0.4); opacity: 0; filter: blur(8px); }
            15% { opacity: 1; }
            40% { transform: translate(-50%, -50%) scaleX(-1) scaleY(1.1); filter: blur(0px); }
            70% { transform: translate(-50%, -50%) scaleX(-1.05) scaleY(1); opacity: 1; filter: blur(1px); }
            100% { transform: translate(-50%, -50%) scaleX(-1.1) scaleY(0.9); opacity: 0; filter: blur(6px); }
          }
          @keyframes dt-spark {
            0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
            20% { opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
          }
          @keyframes dt-shake {
            0%, 100% { transform: translate(0, 0); }
            20% { transform: translate(-3px, 2px); }
            40% { transform: translate(3px, -2px); }
            60% { transform: translate(-2px, -2px); }
            80% { transform: translate(2px, 2px); }
          }
          .dt-fire-layer {
            position: absolute;
            left: 50%; top: 44%;
            width: 70%; height: 18%;
            pointer-events: none;
            z-index: 20;
            mix-blend-mode: screen;
          }
          .dt-fire-core {
            position: absolute; inset: 0;
            border-radius: 50%;
            transform-origin: center;
          }
          .dt-fire-dragon .dt-fire-core {
            background:
              radial-gradient(ellipse 60% 100% at 0% 50%, hsla(210,100%,80%,0.95), hsla(220,100%,55%,0.85) 30%, hsla(200,100%,50%,0.6) 55%, transparent 75%),
              radial-gradient(ellipse 80% 70% at 50% 50%, hsla(45,100%,75%,0.9), hsla(25,100%,55%,0.85) 40%, hsla(15,100%,45%,0.5) 65%, transparent 80%);
            animation: dt-fire-blast-r 1.6s cubic-bezier(.2,.7,.3,1) forwards;
            transform: translate(-50%, -50%);
            left: 50%; top: 50%;
            box-shadow: 0 0 60px 20px hsla(25,100%,55%,0.7), 0 0 120px 40px hsla(220,100%,55%,0.45);
          }
          .dt-fire-tiger .dt-fire-core {
            background:
              radial-gradient(ellipse 60% 100% at 100% 50%, hsla(45,100%,80%,0.95), hsla(25,100%,55%,0.9) 30%, hsla(15,100%,45%,0.6) 55%, transparent 75%),
              radial-gradient(ellipse 80% 70% at 50% 50%, hsla(50,100%,80%,0.95), hsla(20,100%,55%,0.85) 40%, hsla(10,100%,45%,0.55) 65%, transparent 80%);
            animation: dt-fire-blast-l 1.6s cubic-bezier(.2,.7,.3,1) forwards;
            transform: translate(-50%, -50%);
            left: 50%; top: 50%;
            box-shadow: 0 0 60px 20px hsla(20,100%,55%,0.8), 0 0 120px 40px hsla(40,100%,55%,0.5);
          }
          .dt-spark {
            position: absolute; left: 50%; top: 50%;
            width: 30%; height: 80%;
            border-radius: 50%;
            background: radial-gradient(circle, hsla(50,100%,90%,0.95), hsla(30,100%,60%,0.6) 40%, transparent 70%);
            animation: dt-spark 1.2s ease-out forwards;
            filter: blur(2px);
          }
        `}</style>

        {/* WIN FIRE BLAST EFFECT */}
        <AnimatePresence>
          {phase === "result" && winner && winner !== "tie" && (
            <motion.div
              key={`fire-${winner}`}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`dt-fire-layer ${winner === "dragon" ? "dt-fire-dragon" : "dt-fire-tiger"}`}
              style={{ transform: "translate(-50%, -50%)", animation: "dt-shake 0.5s ease-in-out 2" }}
            >
              <div className="dt-fire-core" />
              <div className="dt-spark" />
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
          {phase === "result" && winner === "dragon" && (
            <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 0 3px hsl(220 90% 60%), 0 0 25px hsl(220 90% 60%)" }} />
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
          {phase === "result" && winner === "tiger" && (
            <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 0 3px hsl(28 95% 55%), 0 0 25px hsl(28 95% 55%)" }} />
          )}
        </button>

        {/* PLAYER COUNT / WALLET TOGGLE — bottom-left */}
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
        <div className="absolute flex items-center justify-between" style={{ left: "8%", right: "8%", top: "87.5%", height: "8%" }}>
          {CHIP_VALUES.map((v) => (
            <button
              key={v}
              onClick={() => phase === "betting" && setChip(v)}
              className="relative rounded-full"
              style={{ width: "16%", aspectRatio: "1/1" }}
              aria-label={`Chip ${v}`}
            >
              {chip === v && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: "0 0 0 3px hsl(45 95% 60%), 0 0 18px hsla(45,95%,60%,0.85)" }}
                />
              )}
            </button>
          ))}
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
