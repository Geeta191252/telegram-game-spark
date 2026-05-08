import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Gift, Menu, ClipboardList, Trophy, MessageCircle, Wallet, ChevronRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBalanceContext } from "@/contexts/BalanceContext";
import { reportGameResult, getTelegramUser, type CurrencyType } from "@/lib/telegram";
import { toast } from "sonner";

type Phase = "betting" | "flying" | "crashed";

const PRESETS = [10, 25, 50, 100, 250, 500, 1000];

const generateCrashPoint = () => {
  const r = Math.random();
  if (r < 0.05) return 1.0;
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
  const [history, setHistory] = useState<number[]>([2.4, 1.1, 8.9, 1.0, 3.2, 1.5, 2.7, 1.3, 4.6, 1.0]);
  const [countdown, setCountdown] = useState(5);

  const totalDollar = dollarBalance + dollarWinning;
  const totalStar = starBalance + starWinning;
  const balance = currency === "dollar" ? totalDollar : totalStar;

  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

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
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }
    if (phase === "crashed") {
      if (hasBet && cashedOutAt === null) {
        toast.error(`💥 Crashed at ${crashAt.toFixed(2)}x — Bet lost`);
        reportGameResult({ betAmount, winAmount: 0, currency, game: "aviator" })
          .then(() => refreshBalance()).catch(() => {});
      }
      setHistory((h) => [Number(crashAt.toFixed(2)), ...h].slice(0, 10));
      const t = setTimeout(() => { setHasBet(false); setPhase("betting"); }, 2500);
      return () => clearTimeout(t);
    }
  }, [phase]); // eslint-disable-line

  const placeBet = () => {
    if (phase !== "betting") return toast.error("Wait for next round");
    if (betAmount <= 0) return toast.error("Enter valid amount");
    if (betAmount > balance) return toast.error("Insufficient balance");
    setHasBet(true);
    toast.success(`Bet placed: ${currency === "dollar" ? "$" : "⭐"}${betAmount}`);
  };

  const cashOut = useCallback(async () => {
    if (phase !== "flying" || !hasBet || cashedOutAt !== null) return;
    const m = multiplier;
    const win = Number((betAmount * m).toFixed(2));
    setCashedOutAt(m);
    toast.success(`💰 Cashed @ ${m.toFixed(2)}x — Won ${currency === "dollar" ? "$" : "⭐"}${win}`);
    try {
      await reportGameResult({ betAmount, winAmount: win, currency, game: "aviator" });
      refreshBalance();
    } catch (e) { console.error(e); }
  }, [phase, hasBet, cashedOutAt, multiplier, betAmount, currency, refreshBalance]);

  // Plane curve: bottom-left to top-right via quadratic bezier (matches mockup)
  const progress = phase === "flying" ? Math.min((multiplier - 1) / 5, 0.95) : 0;
  const sX = 5, sY = 95, cX = 50, cY = 95, eX = 88, eY = 14;
  const t = progress;
  const planeX = (1 - t) * (1 - t) * sX + 2 * (1 - t) * t * cX + t * t * eX;
  const planeY = (1 - t) * (1 - t) * sY + 2 * (1 - t) * t * cY + t * t * eY;
  const dx = 2 * (1 - t) * (cX - sX) + 2 * t * (eX - cX);
  const dy = 2 * (1 - t) * (cY - sY) + 2 * t * (eY - cY);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  const userName = tgUser?.first_name || tgUser?.username || "Aviator99";
  const avatarUrl = (tgUser as any)?.photo_url;

  const historyColor = (h: number) => {
    if (h <= 1.05) return { border: "hsl(0 75% 55%)", text: "hsl(0 90% 70%)", bg: "hsla(0, 70%, 25%, 0.35)" };
    if (h >= 5) return { border: "hsl(280 70% 60%)", text: "hsl(280 90% 75%)", bg: "hsla(280, 60%, 25%, 0.35)" };
    if (h >= 2) return { border: "hsl(195 80% 55%)", text: "hsl(195 90% 70%)", bg: "hsla(195, 60%, 20%, 0.35)" };
    return { border: "hsl(35 90% 55%)", text: "hsl(40 95% 65%)", bg: "hsla(35, 70%, 20%, 0.35)" };
  };

  return (
    <div className="min-h-screen relative overflow-hidden text-white" style={{
      background: "radial-gradient(ellipse at 30% 20%, hsl(265 50% 14%) 0%, hsl(260 55% 8%) 60%, hsl(255 60% 4%) 100%)",
    }}>
      {/* Stars */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {[...Array(60)].map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            width: `${1 + (i % 3)}px`, height: `${1 + (i % 3)}px`,
            top: `${(i * 37) % 100}%`, left: `${(i * 53) % 100}%`,
            opacity: 0.2 + ((i % 5) / 12),
          }} />
        ))}
      </div>

      <div className="relative z-10 flex flex-col min-h-screen pb-2">
        {/* Header */}
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          <button onClick={() => navigate("/")} className="h-12 w-12 rounded-full overflow-hidden shrink-0" style={{ border: "2px solid hsl(280 70% 55%)" }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-lg" style={{ background: "linear-gradient(135deg, hsl(280 60% 35%), hsl(310 55% 30%))" }}>
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
          <div className="flex flex-col">
            <span className="font-bold text-[15px] leading-tight">{userName}</span>
            <div className="flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-md self-start" style={{ background: "hsla(280, 50%, 20%, 0.7)", border: "1px solid hsla(280, 60%, 50%, 0.4)" }}>
              <Star className="h-2.5 w-2.5 fill-current" style={{ color: "hsl(45 95% 60%)" }} />
              <span className="text-[10px] font-bold tracking-wider" style={{ color: "hsl(280 80% 75%)" }}>VIP</span>
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{
              background: "hsla(265, 40%, 12%, 0.7)",
              border: "1.5px solid hsl(280 70% 55%)",
              boxShadow: "0 0 16px hsla(280, 70%, 50%, 0.3)",
            }}>
              <span className="font-extrabold text-[15px]">
                {currency === "dollar" ? `$${totalDollar.toFixed(2)}` : `⭐${totalStar}`}
              </span>
              <Wallet className="h-4 w-4" style={{ color: "hsl(40 90% 55%)" }} />
              <button onClick={() => navigate("/wallet")} className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: "hsla(280, 60%, 40%, 0.6)" }}>
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          <button className="relative h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "hsla(265, 40%, 15%, 0.7)", border: "1.5px solid hsl(280 70% 55%)" }}>
            <Gift className="h-4 w-4" style={{ color: "hsl(280 80% 70%)" }} />
            <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
          <button className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "hsla(265, 40%, 15%, 0.7)", border: "1.5px solid hsl(280 70% 55%)" }}>
            <Menu className="h-4 w-4" style={{ color: "hsl(280 80% 70%)" }} />
          </button>
        </div>

        {/* Previous rounds */}
        <div className="px-3 pt-1 pb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold tracking-[0.15em]" style={{ color: "hsl(280 30% 65%)" }}>PREVIOUS ROUNDS</span>
            <button className="flex items-center gap-0.5 text-[11px] font-bold tracking-wider" style={{ color: "hsl(280 30% 65%)" }}>
              VIEW ALL <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {history.map((h, i) => {
              const c = historyColor(h);
              const isCrash = h <= 1.05;
              return (
                <div key={i} className="rounded-full px-2.5 py-1 text-[11px] font-extrabold shrink-0" style={{
                  background: c.bg, border: `1px solid ${c.border}`, color: c.text,
                }}>
                  {isCrash ? "CRASH" : `${h.toFixed(h >= 10 ? 1 : 1)}x`}
                </div>
              );
            })}
          </div>
        </div>

        {/* Game arena */}
        <div className="flex-1 relative mx-3 rounded-3xl overflow-hidden" style={{
          background: "radial-gradient(ellipse at 30% 70%, hsla(285, 70%, 30%, 0.55) 0%, hsla(265, 60%, 12%, 0.95) 60%)",
          minHeight: 360,
        }}>
          {/* Inner stars */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(40)].map((_, i) => (
              <div key={i} className="absolute rounded-full bg-white" style={{
                width: `${1 + (i % 3)}px`, height: `${1 + (i % 3)}px`,
                top: `${(i * 41) % 100}%`, left: `${(i * 67) % 100}%`,
                opacity: 0.25 + ((i % 5) / 12),
              }} />
            ))}
          </div>

          {/* Trail */}
          {phase === "flying" && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="trailGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(310, 95%, 55%)" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="hsl(330, 100%, 60%)" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="hsl(40, 100%, 65%)" stopOpacity="1" />
                </linearGradient>
                <linearGradient id="trailFill" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(310, 90%, 55%)" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="hsl(330, 95%, 60%)" stopOpacity="0.25" />
                </linearGradient>
              </defs>
              <path d={`M ${sX} ${sY} Q ${cX} ${cY}, ${planeX} ${planeY} L ${planeX} 100 L ${sX} 100 Z`} fill="url(#trailFill)" />
              <path d={`M ${sX} ${sY} Q ${cX} ${cY}, ${planeX} ${planeY}`} stroke="url(#trailGrad)" strokeWidth="1.4" strokeLinecap="round" fill="none" style={{ filter: "drop-shadow(0 0 1.5px hsl(330 100% 60%))" }} />
            </svg>
          )}

          {/* Multiplier center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {phase === "betting" ? (
              <div className="text-center">
                <div className="text-xs font-bold tracking-[0.2em] mb-2" style={{ color: "hsl(280 50% 75%)" }}>NEXT ROUND IN</div>
                <div className="text-7xl font-black" style={{
                  background: "linear-gradient(180deg, hsl(45 100% 65%), hsl(25 95% 55%))",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 25px hsla(40, 100%, 55%, 0.7))",
                  fontFamily: "'Russo One', Impact, sans-serif",
                }}>{countdown}</div>
              </div>
            ) : (
              <motion.div animate={phase === "crashed" ? { scale: [1, 1.15, 0.95] } : {}} className="text-center">
                <div className="text-[80px] leading-none font-black tracking-tight" style={{
                  background: phase === "crashed"
                    ? "linear-gradient(180deg, hsl(0 95% 65%), hsl(15 90% 50%))"
                    : "linear-gradient(180deg, hsl(45 100% 70%), hsl(30 95% 55%), hsl(15 90% 50%))",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  filter: `drop-shadow(0 0 30px ${phase === "crashed" ? "hsla(0, 95%, 50%, 0.7)" : "hsla(35, 100%, 55%, 0.75)"})`,
                  fontFamily: "'Russo One', Impact, sans-serif",
                }}>
                  {multiplier.toFixed(2)}<span className="text-[60px]">x</span>
                </div>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <div className="h-px w-8" style={{ background: "hsla(0,0%,100%,0.4)" }} />
                  <span className="text-[13px] font-extrabold italic tracking-[0.18em]" style={{ color: phase === "crashed" ? "hsl(0 90% 75%)" : "white" }}>
                    {phase === "crashed" ? "CRASHED!" : "FLYING HIGH!"}
                  </span>
                  <div className="h-px w-8" style={{ background: "hsla(0,0%,100%,0.4)" }} />
                </div>
              </motion.div>
            )}
          </div>

          {/* Plane */}
          {phase === "flying" && (
            <div className="absolute pointer-events-none" style={{
              left: `${planeX}%`, top: `${planeY}%`,
              transform: `translate(-50%, -50%) rotate(${angle}deg)`,
              transition: "left 0.05s linear, top 0.05s linear",
              filter: "drop-shadow(0 0 10px hsla(0, 90%, 55%, 0.7)) drop-shadow(0 4px 12px hsla(0, 0%, 0%, 0.6))",
            }}>
              <PlaneSVG />
            </div>
          )}
          {phase === "crashed" && (
            <motion.div className="absolute pointer-events-none" style={{ left: `${planeX}%`, top: `${planeY}%`, transform: "translate(-50%, -50%)" }}
              animate={{ y: 280, rotate: 540, opacity: 0 }} transition={{ duration: 1.6, ease: "easeIn" }}>
              <PlaneSVG dim />
            </motion.div>
          )}

          {/* Planet glow bottom-left */}
          <div className="absolute -left-8 -bottom-8 w-40 h-40 rounded-full pointer-events-none" style={{
            background: "radial-gradient(circle at 70% 30%, hsla(280, 80%, 50%, 0.5), hsla(310, 70%, 40%, 0.2) 60%, transparent 75%)",
            filter: "blur(2px)",
          }} />
        </div>

        {/* Bet panel */}
        <div className="mx-3 mt-3 rounded-2xl p-3" style={{
          background: "linear-gradient(135deg, hsla(265, 50%, 14%, 0.95), hsla(280, 45%, 11%, 0.95))",
          border: "1.5px solid hsl(280 60% 45%)",
          boxShadow: "0 0 24px hsla(280, 60%, 40%, 0.25)",
        }}>
          <div className="text-[10px] font-extrabold tracking-[0.18em] mb-1.5" style={{ color: "hsl(280 35% 70%)" }}>BET AMOUNT</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-xl px-4 h-12 flex items-center" style={{
              background: "hsla(265, 50%, 8%, 0.9)", border: "1px solid hsla(280, 50%, 35%, 0.5)",
            }}>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
                className="w-full bg-transparent text-2xl font-black focus:outline-none"
              />
            </div>
            <div className="flex h-12 rounded-xl overflow-hidden" style={{ background: "hsla(265, 50%, 8%, 0.9)", border: "1px solid hsla(280, 50%, 35%, 0.5)" }}>
              <button onClick={() => setCurrency("dollar")} className="px-3 h-full flex items-center justify-center text-xs font-extrabold" style={{
                background: currency === "dollar" ? "linear-gradient(135deg, hsl(280 60% 40%), hsl(295 55% 35%))" : "transparent",
                color: "white",
              }}>USD</button>
              <button onClick={() => setCurrency("star")} className="px-3 h-full flex items-center justify-center" style={{
                background: currency === "star" ? "linear-gradient(135deg, hsl(40 95% 50%), hsl(30 90% 45%))" : "transparent",
              }}>
                <Star className="h-5 w-5 fill-current" style={{ color: currency === "star" ? "hsl(0 0% 10%)" : "hsl(45 95% 60%)" }} />
              </button>
            </div>
          </div>

          {/* Presets */}
          <div className="grid grid-cols-7 gap-1.5 mt-2.5">
            {PRESETS.map((amt) => {
              const active = betAmount === amt;
              return (
                <button key={amt} onClick={() => setBetAmount(amt)} className="h-8 rounded-lg text-[11px] font-bold transition" style={{
                  background: active ? "hsla(280, 60%, 25%, 0.8)" : "hsla(265, 30%, 12%, 0.6)",
                  border: `1px solid ${active ? "hsl(280 80% 60%)" : "hsla(280, 40%, 30%, 0.4)"}`,
                  color: active ? "white" : "hsl(280 30% 70%)",
                  boxShadow: active ? "0 0 10px hsla(280, 70%, 50%, 0.5)" : "none",
                }}>
                  {amt}
                </button>
              );
            })}
          </div>

          {/* Action button */}
          <div className="mt-3">
            {phase === "flying" && hasBet && cashedOutAt === null ? (
              <motion.button whileTap={{ scale: 0.97 }} onClick={cashOut}
                animate={{ boxShadow: ["0 0 20px hsla(0, 80%, 50%, 0.5)", "0 0 35px hsla(0, 80%, 50%, 0.85)", "0 0 20px hsla(0, 80%, 50%, 0.5)"] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="w-full h-14 rounded-2xl font-black text-xl flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(180deg, hsl(0 85% 58%), hsl(10 80% 45%))", color: "white", fontFamily: "'Russo One', Impact, sans-serif", letterSpacing: "0.05em" }}>
                CASH OUT @ {multiplier.toFixed(2)}x
              </motion.button>
            ) : phase === "flying" && cashedOutAt !== null ? (
              <div className="w-full h-14 rounded-2xl font-black text-xl flex items-center justify-center" style={{
                background: "linear-gradient(180deg, hsl(140 70% 45%), hsl(155 60% 35%))", color: "white", fontFamily: "'Russo One', Impact, sans-serif",
              }}>✓ CASHED @ {cashedOutAt.toFixed(2)}x</div>
            ) : (
              <motion.button whileTap={{ scale: 0.97 }} onClick={placeBet} disabled={hasBet || phase !== "betting"}
                animate={!hasBet && phase === "betting" ? { boxShadow: ["0 0 20px hsla(140, 80%, 45%, 0.5)", "0 0 38px hsla(140, 80%, 45%, 0.85)", "0 0 20px hsla(140, 80%, 45%, 0.5)"] } : {}}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="w-full h-14 rounded-2xl font-black text-2xl flex items-center justify-center gap-3 disabled:opacity-70"
                style={{
                  background: hasBet
                    ? "linear-gradient(180deg, hsl(40 90% 55%), hsl(30 85% 45%))"
                    : "linear-gradient(180deg, hsl(135 75% 55%), hsl(145 70% 40%))",
                  color: "white", fontFamily: "'Russo One', Impact, sans-serif", letterSpacing: "0.06em",
                  textShadow: "0 2px 4px hsla(0,0%,0%,0.3)",
                }}>
                {hasBet ? "⏳ WAITING..." : (
                  <>
                    PLACE BET
                    <svg width="28" height="28" viewBox="0 0 64 64"><polygon points="6,32 56,28 32,34" fill="white" opacity="0.95" /><polygon points="6,32 56,28 28,42" fill="white" opacity="0.7" /></svg>
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>

        {/* Bottom nav */}
        <div className="grid grid-cols-4 gap-1 px-2 pt-3 pb-1">
          {[
            { icon: PlaneNavIcon, label: "Aviator", active: true },
            { icon: ClipboardList, label: "My Bets" },
            { icon: Trophy, label: "Top" },
            { icon: MessageCircle, label: "Chat", badge: 128 },
          ].map((item: any) => {
            const Icon = item.icon;
            return (
              <button key={item.label} className="flex flex-col items-center gap-0.5 py-1 relative">
                <div className="relative">
                  <Icon className="h-6 w-6" style={{ color: item.active ? "hsl(280 85% 70%)" : "hsl(280 25% 55%)" }} />
                  {item.badge && (
                    <div className="absolute -top-1 -right-2 min-w-[18px] h-[16px] rounded-full px-1 flex items-center justify-center text-[9px] font-bold" style={{ background: "hsl(140 70% 45%)" }}>
                      {item.badge}
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-bold" style={{ color: item.active ? "hsl(280 85% 70%)" : "hsl(280 25% 55%)" }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const PlaneSVG = ({ dim = false }: { dim?: boolean }) => (
  <svg width="68" height="68" viewBox="0 0 64 64" style={{ display: "block" }}>
    <defs>
      <linearGradient id="planeBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={dim ? "#7a1010" : "#ff5555"} />
        <stop offset="60%" stopColor={dim ? "#5a0808" : "#c81e1e"} />
        <stop offset="100%" stopColor="#5a0000" />
      </linearGradient>
      <linearGradient id="planeShade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor={dim ? "#a02525" : "#ff8585"} />
        <stop offset="100%" stopColor={dim ? "#600505" : "#a01515"} />
      </linearGradient>
    </defs>
    <polygon points="6,32 56,28 32,34" fill="url(#planeShade)" stroke="#3a0000" strokeWidth="0.8" strokeLinejoin="round" />
    <polygon points="6,32 56,28 28,42" fill="url(#planeBody)" stroke="#2a0000" strokeWidth="0.8" strokeLinejoin="round" />
    <line x1="6" y1="32" x2="56" y2="28" stroke="#ffb0b0" strokeWidth="0.6" opacity="0.7" />
    <polygon points="6,32 14,30 14,34" fill="#3a0000" opacity="0.7" />
  </svg>
);

const PlaneNavIcon = (props: any) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M2 12 L20 8 L12 12.5 Z" />
    <path d="M2 12 L20 8 L11 16 Z" opacity="0.7" />
  </svg>
);

export default AviatorGame;
