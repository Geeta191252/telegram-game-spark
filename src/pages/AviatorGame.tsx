import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Rocket, Plus, Minus, Volume2, VolumeX, History, Trophy, Settings as SettingsIcon, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBalanceContext } from "@/contexts/BalanceContext";
import { reportGameResult, getTelegramUser, type CurrencyType } from "@/lib/telegram";
import { toast } from "sonner";
import homeBg from "@/assets/home-bg.png";

type Phase = "betting" | "flying" | "crashed";

const PRESET_AMOUNTS = [10, 50, 100, 500, 1000];

// Provably-fair-ish crash point generator (client side for now)
const generateCrashPoint = () => {
  const r = Math.random();
  // 5% instant crash 1.0x, otherwise heavy-tail distribution
  if (r < 0.05) return 1.0;
  // Inverse exponential, capped at 50x
  const x = 1 / (1 - Math.random());
  return Math.min(Math.max(1.01, x), 50);
};

const AviatorGame = () => {
  const navigate = useNavigate();
  const { dollarBalance, starBalance, dollarWinning, starWinning, refreshBalance } = useBalanceContext();
  const tgUser = getTelegramUser();

  const [currency, setCurrency] = useState<CurrencyType>("dollar");
  const [betAmount, setBetAmount] = useState(100);
  const [phase, setPhase] = useState<Phase>("betting");
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashAt, setCrashAt] = useState(2.0);
  const [hasBet, setHasBet] = useState(false);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([2.4, 1.1, 8.9, 1.0, 3.2]);
  const [soundOn, setSoundOn] = useState(true);
  const [countdown, setCountdown] = useState(5);

  const totalDollar = dollarBalance + dollarWinning;
  const totalStar = starBalance + starWinning;
  const balance = currency === "dollar" ? totalDollar : totalStar;

  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // Round loop
  useEffect(() => {
    if (phase === "betting") {
      setMultiplier(1.0);
      setCashedOutAt(null);
      setCountdown(5);
      const tick = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(tick);
            setCrashAt(generateCrashPoint());
            setPhase("flying");
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(tick);
    }

    if (phase === "flying") {
      startTimeRef.current = performance.now();
      const animate = (now: number) => {
        const elapsed = (now - startTimeRef.current) / 1000;
        // Multiplier curve: exponential growth
        const m = Math.pow(1.07, elapsed * 4);
        if (m >= crashAt) {
          setMultiplier(crashAt);
          setPhase("crashed");
          return;
        }
        setMultiplier(m);
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    if (phase === "crashed") {
      // Lock loss if bet active and not cashed out
      if (hasBet && cashedOutAt === null) {
        toast.error(`💥 Crashed at ${crashAt.toFixed(2)}x — Bet lost`);
        // Report loss to backend
        reportGameResult({
          betAmount,
          winAmount: 0,
          currency,
          game: "aviator",
        }).then(() => refreshBalance()).catch(() => {});
      }
      setHistory((h) => [Number(crashAt.toFixed(2)), ...h].slice(0, 8));
      const t = setTimeout(() => {
        setHasBet(false);
        setPhase("betting");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeBet = () => {
    if (phase !== "betting") {
      toast.error("Wait for next round");
      return;
    }
    if (betAmount <= 0) {
      toast.error("Enter valid amount");
      return;
    }
    if (betAmount > balance) {
      toast.error("Insufficient balance");
      return;
    }
    setHasBet(true);
    toast.success(`Bet placed: ${currency === "dollar" ? "$" : "⭐"}${betAmount}`);
  };

  const cashOut = useCallback(async () => {
    if (phase !== "flying" || !hasBet || cashedOutAt !== null) return;
    const m = multiplier;
    const win = Number((betAmount * m).toFixed(2));
    setCashedOutAt(m);
    toast.success(`💰 Cashed out at ${m.toFixed(2)}x — Won ${currency === "dollar" ? "$" : "⭐"}${win}`);
    try {
      await reportGameResult({
        betAmount,
        winAmount: win,
        currency,
        game: "aviator",
      });
      refreshBalance();
    } catch (e) {
      console.error(e);
    }
  }, [phase, hasBet, cashedOutAt, multiplier, betAmount, currency, refreshBalance]);

  // Plane/rocket position based on multiplier (smooth curve from bottom-left to top-right)
  const progress = Math.min((multiplier - 1) / 5, 0.95); // 0 to 0.95
  // Quadratic curve points (in % of arena)
  const startX = 5, startY = 95;
  const endX = 88, endY = 12;
  // Control point for the curve (creates the upward arc)
  const ctrlX = 50, ctrlY = 95;
  // Bezier point at progress t
  const t = progress;
  const planeX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ctrlX + t * t * endX;
  const planeY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * ctrlY + t * t * endY;
  // Tangent angle (derivative of bezier) for rocket rotation
  const dx = 2 * (1 - t) * (ctrlX - startX) + 2 * t * (endX - ctrlX);
  const dy = 2 * (1 - t) * (ctrlY - startY) + 2 * t * (endY - ctrlY);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  const userName = tgUser?.first_name || tgUser?.username || "Player";

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "hsl(265 50% 8%)" }}>
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <img src={homeBg} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, hsla(265, 60%, 8%, 0.85) 0%, hsla(285, 50%, 10%, 0.8) 50%, hsla(260, 55%, 12%, 0.9) 100%)",
        }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <div className="px-3 py-3 flex items-center justify-between" style={{
          background: "linear-gradient(135deg, hsla(265, 55%, 18%, 0.95), hsla(280, 50%, 15%, 0.95))",
          borderBottom: "1px solid hsla(280, 60%, 50%, 0.2)",
          backdropFilter: "blur(20px)",
        }}>
          <div className="flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/")} className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "hsla(280, 50%, 30%, 0.5)" }}>
              <ArrowLeft className="h-4 w-4 text-white" />
            </motion.button>
            <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(280 60% 45%), hsl(310 55% 40%))" }}>
              <Rocket className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm text-white">{userName}</span>
                <span className="text-xs">✓</span>
              </div>
              <div className="flex items-center gap-1 text-[10px]" style={{ color: "hsl(45 90% 65%)" }}>
                <Star className="h-2.5 w-2.5 fill-current" /> VIP
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full px-3 py-1.5 flex items-center gap-1.5" style={{
              background: "linear-gradient(135deg, hsla(265, 50%, 25%, 0.8), hsla(280, 45%, 20%, 0.8))",
              border: "1px solid hsla(140, 60%, 50%, 0.3)",
            }}>
              <span className="text-xs font-bold text-white">
                {currency === "dollar" ? `$${totalDollar.toFixed(2)}` : `⭐${totalStar}`}
              </span>
              <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: "hsl(140 60% 45%)" }}>
                <Plus className="h-3 w-3 text-white" />
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSoundOn(!soundOn)} className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "hsla(280, 50%, 30%, 0.5)" }}>
              {soundOn ? <Volume2 className="h-4 w-4 text-white" /> : <VolumeX className="h-4 w-4 text-white" />}
            </motion.button>
          </div>
        </div>

        {/* History chips */}
        <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {history.map((h, i) => {
            const isHigh = h >= 2;
            const isCrash = h <= 1.05;
            return (
              <div key={i} className="rounded-full px-3 py-1 text-xs font-bold shrink-0" style={{
                background: "hsla(265, 40%, 15%, 0.7)",
                border: `1px solid ${isCrash ? "hsl(0 70% 50%)" : isHigh ? "hsl(140 70% 50%)" : "hsl(45 80% 55%)"}`,
                color: isCrash ? "hsl(0 90% 70%)" : isHigh ? "hsl(140 90% 70%)" : "hsl(45 95% 70%)",
              }}>
                {isCrash ? "CRASH" : `${h.toFixed(h >= 10 ? 1 : 2)}x`}
              </div>
            );
          })}
          <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 ml-auto" style={{
            background: "hsla(265, 40%, 15%, 0.7)",
            border: "1px solid hsla(280, 60%, 50%, 0.3)",
          }}>
            <History className="h-3.5 w-3.5 text-white/70" />
          </div>
        </div>

        {/* Game arena */}
        <div className="flex-1 relative mx-3 my-2 rounded-3xl overflow-hidden" style={{
          background: "radial-gradient(ellipse at center, hsla(285, 60%, 25%, 0.6), hsla(265, 50%, 10%, 0.9))",
          border: "1px solid hsla(280, 60%, 50%, 0.3)",
          minHeight: "380px",
        }}>
          {/* Stars */}
          <div className="absolute inset-0">
            {[...Array(30)].map((_, i) => (
              <div key={i} className="absolute rounded-full bg-white" style={{
                width: `${1 + (i % 3)}px`,
                height: `${1 + (i % 3)}px`,
                top: `${(i * 37) % 100}%`,
                left: `${(i * 53) % 100}%`,
                opacity: 0.3 + ((i % 5) / 10),
              }} />
            ))}
          </div>

          {/* Trail SVG — quadratic bezier matching rocket position */}
          {phase === "flying" && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="trailGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(310, 90%, 55%)" stopOpacity="0.1" />
                  <stop offset="40%" stopColor="hsl(320, 95%, 60%)" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="hsl(45, 100%, 65%)" stopOpacity="1" />
                </linearGradient>
                <linearGradient id="trailFill" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(310, 90%, 50%)" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="hsl(310, 90%, 60%)" stopOpacity="0.25" />
                </linearGradient>
              </defs>
              {/* Filled area under curve for glow effect */}
              <path
                d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY}, ${planeX} ${planeY} L ${planeX} 100 L ${startX} 100 Z`}
                fill="url(#trailFill)"
              />
              {/* Main trail line */}
              <path
                d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY}, ${planeX} ${planeY}`}
                stroke="url(#trailGrad)"
                strokeWidth="1.2"
                strokeLinecap="round"
                fill="none"
                style={{ filter: "drop-shadow(0 0 1.5px hsl(310 95% 60%))" }}
              />
            </svg>
          )}

          {/* Multiplier */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {phase === "betting" ? (
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
                <div className="text-sm font-semibold mb-2" style={{ color: "hsl(280 60% 80%)" }}>NEXT ROUND IN</div>
                <div className="text-6xl font-black" style={{
                  background: "linear-gradient(180deg, hsl(45 95% 65%), hsl(25 90% 55%))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 20px hsla(45, 90%, 55%, 0.6))",
                }}>{countdown}</div>
              </motion.div>
            ) : (
              <motion.div
                animate={phase === "crashed" ? { scale: [1, 1.2, 0.9], rotate: [0, -5, 5, 0] } : {}}
                className="text-center"
              >
                <div className="text-7xl font-black tracking-tight" style={{
                  background: phase === "crashed"
                    ? "linear-gradient(180deg, hsl(0 90% 65%), hsl(15 85% 50%))"
                    : "linear-gradient(180deg, hsl(45 95% 65%), hsl(25 90% 55%), hsl(15 85% 50%))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: `drop-shadow(0 0 25px ${phase === "crashed" ? "hsla(0, 90%, 50%, 0.7)" : "hsla(35, 95%, 55%, 0.7)"})`,
                  fontFamily: "'Russo One', sans-serif",
                }}>
                  {multiplier.toFixed(2)}x
                </div>
                <div className="mt-1 text-xs font-bold tracking-widest" style={{ color: phase === "crashed" ? "hsl(0 90% 70%)" : "hsl(45 90% 70%)" }}>
                  {phase === "crashed" ? "✦ CRASHED ✦" : "✦ FLYING HIGH ✦"}
                </div>
              </motion.div>
            )}
          </div>

          {/* Rocket */}
          {phase === "flying" && (
            <motion.div
              className="absolute"
              style={{
                left: `${planeX}%`,
                top: `${planeY}%`,
                transform: "translate(-50%, -50%)",
              }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <div className="text-5xl" style={{ filter: "drop-shadow(0 0 10px hsl(310 90% 60%))", transform: "rotate(-30deg)" }}>
                🚀
              </div>
            </motion.div>
          )}
          {phase === "crashed" && (
            <motion.div
              className="absolute"
              style={{ left: `${planeX}%`, top: `${planeY}%`, transform: "translate(-50%, -50%)" }}
              animate={{ y: 200, rotate: 180, opacity: 0 }}
              transition={{ duration: 1.2 }}
            >
              <div className="text-5xl">💥</div>
            </motion.div>
          )}
        </div>

        {/* Bet panel */}
        <div className="mx-3 mb-3 rounded-2xl p-3" style={{
          background: "linear-gradient(135deg, hsla(265, 55%, 18%, 0.95), hsla(280, 50%, 15%, 0.95))",
          border: "1px solid hsla(280, 60%, 50%, 0.25)",
          backdropFilter: "blur(20px)",
        }}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Bet amount */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "hsl(280 50% 70%)" }}>Bet Amount</div>
              <div className="flex items-center rounded-xl overflow-hidden" style={{
                background: "hsla(265, 40%, 12%, 0.8)",
                border: "1px solid hsla(280, 60%, 50%, 0.2)",
              }}>
                <button onClick={() => setBetAmount((v) => Math.max(1, v - 10))} className="h-10 w-10 flex items-center justify-center" style={{ background: "hsla(265, 50%, 20%, 0.6)" }}>
                  <Minus className="h-4 w-4 text-white" />
                </button>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
                  className="flex-1 bg-transparent text-center text-white font-bold focus:outline-none"
                />
                <button onClick={() => setBetAmount((v) => v + 10)} className="h-10 w-10 flex items-center justify-center" style={{ background: "hsla(265, 50%, 20%, 0.6)" }}>
                  <Plus className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            {/* Currency */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "hsl(280 50% 70%)" }}>Currency</div>
              <div className="flex items-center rounded-xl overflow-hidden" style={{
                background: "hsla(265, 40%, 12%, 0.8)",
                border: "1px solid hsla(280, 60%, 50%, 0.2)",
              }}>
                <button
                  onClick={() => setCurrency("dollar")}
                  className="flex-1 h-10 flex items-center justify-center gap-1.5 text-sm font-bold"
                  style={{
                    background: currency === "dollar" ? "linear-gradient(135deg, hsl(140 65% 42%), hsl(160 55% 38%))" : "transparent",
                    color: "white",
                  }}
                >
                  <span>💲</span> USD
                </button>
                <button
                  onClick={() => setCurrency("star")}
                  className="flex-1 h-10 flex items-center justify-center gap-1 text-sm font-bold"
                  style={{
                    background: currency === "star" ? "linear-gradient(135deg, hsl(40 90% 50%), hsl(25 85% 45%))" : "transparent",
                    color: currency === "star" ? "hsl(0 0% 10%)" : "white",
                  }}
                >
                  ⭐ Star
                </button>
              </div>
            </div>
          </div>

          {/* Preset amounts */}
          <div className="flex gap-1.5 mb-3">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => setBetAmount(amt)}
                className="flex-1 h-8 rounded-lg text-xs font-bold transition"
                style={{
                  background: betAmount === amt ? "linear-gradient(135deg, hsl(280 60% 45%), hsl(310 55% 40%))" : "hsla(265, 40%, 15%, 0.6)",
                  border: `1px solid ${betAmount === amt ? "hsl(280 70% 60%)" : "hsla(280, 50%, 30%, 0.3)"}`,
                  color: "white",
                }}
              >
                {amt}
              </button>
            ))}
          </div>

          {/* Action button */}
          {phase === "flying" && hasBet && cashedOutAt === null ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={cashOut}
              animate={{ boxShadow: ["0 0 20px hsla(0, 80%, 50%, 0.5)", "0 0 30px hsla(0, 80%, 50%, 0.8)", "0 0 20px hsla(0, 80%, 50%, 0.5)"] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="w-full h-14 rounded-xl font-black text-lg flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, hsl(0 80% 55%), hsl(15 75% 45%))",
                color: "white",
                fontFamily: "'Russo One', sans-serif",
              }}
            >
              CASH OUT @ {multiplier.toFixed(2)}x
            </motion.button>
          ) : phase === "flying" && cashedOutAt !== null ? (
            <div className="w-full h-14 rounded-xl font-black text-lg flex items-center justify-center gap-2" style={{
              background: "linear-gradient(135deg, hsl(140 65% 40%), hsl(160 55% 35%))",
              color: "white",
              fontFamily: "'Russo One', sans-serif",
            }}>
              ✓ CASHED @ {cashedOutAt.toFixed(2)}x
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={placeBet}
              disabled={hasBet || phase !== "betting"}
              animate={!hasBet && phase === "betting" ? { boxShadow: ["0 0 20px hsla(140, 70%, 45%, 0.4)", "0 0 35px hsla(140, 70%, 45%, 0.7)", "0 0 20px hsla(140, 70%, 45%, 0.4)"] } : {}}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="w-full h-14 rounded-xl font-black text-lg flex items-center justify-center gap-2 disabled:opacity-60"
              style={{
                background: hasBet
                  ? "linear-gradient(135deg, hsl(45 80% 50%), hsl(35 75% 45%))"
                  : "linear-gradient(135deg, hsl(140 70% 45%), hsl(160 60% 40%))",
                color: hasBet ? "hsl(0 0% 10%)" : "white",
                fontFamily: "'Russo One', sans-serif",
              }}
            >
              {hasBet ? "⏳ WAITING FOR LIFTOFF" : "🚀 PLACE BET"}
            </motion.button>
          )}
        </div>

        {/* Bottom nav */}
        <div className="grid grid-cols-4 gap-1 px-3 py-2 mb-1">
          {[
            { icon: Rocket, label: "GAME", active: true },
            { icon: History, label: "HISTORY" },
            { icon: Trophy, label: "LEADERBOARD" },
            { icon: SettingsIcon, label: "SETTINGS" },
          ].map((item) => (
            <button key={item.label} className="flex flex-col items-center gap-0.5 py-1">
              <item.icon className="h-4 w-4" style={{ color: item.active ? "hsl(280 80% 70%)" : "hsl(280 30% 55%)" }} />
              <span className="text-[9px] font-bold tracking-wider" style={{ color: item.active ? "hsl(280 80% 70%)" : "hsl(280 30% 55%)" }}>{item.label}</span>
              {item.active && <div className="h-0.5 w-6 rounded-full" style={{ background: "hsl(280 80% 70%)" }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AviatorGame;
