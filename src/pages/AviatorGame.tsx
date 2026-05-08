import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ClipboardList, Menu, MessageCircle, Plus, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBalanceContext } from "@/contexts/BalanceContext";
import { getTelegramUser, reportGameResult, type CurrencyType } from "@/lib/telegram";
import { toast } from "sonner";
import logoImg from "@/assets/aviator/logo.png";
import planeImg from "@/assets/aviator/plane.png";
import plane0 from "@/assets/aviator/plane-0.svg";
import plane1 from "@/assets/aviator/plane-1.svg";
import plane2 from "@/assets/aviator/plane-2.svg";
import plane3 from "@/assets/aviator/plane-3.svg";
import staticPlane from "@/assets/aviator/static-plane.png";
import rotateBg from "@/assets/aviator/bg-rotate-old.svg";
import xAxis from "@/assets/aviator/x-axis.png";
import yAxis from "@/assets/aviator/y-axis.png";

type Phase = "betting" | "flying" | "crashed";

type BetRow = {
  user: string;
  amount: number;
  multiplier: number | null;
  cashout: number | null;
};

const PRESETS = [100, 200, 500, 1000];
const PLANE_FRAMES = [plane0, plane1, plane2, plane3];

const seededRows: BetRow[] = [
  { user: "A***7", amount: 420, multiplier: 2.14, cashout: 898.8 },
  { user: "R***2", amount: 100, multiplier: null, cashout: null },
  { user: "K***9", amount: 750, multiplier: 1.64, cashout: 1230 },
  { user: "M***4", amount: 250, multiplier: null, cashout: null },
  { user: "S***1", amount: 1000, multiplier: 3.08, cashout: 3080 },
  { user: "D***8", amount: 150, multiplier: null, cashout: null },
];

const generateCrashPoint = () => {
  const r = Math.random();
  if (r < 0.15) return Number((1 + Math.random() * 0.35).toFixed(2));
  if (r < 0.65) return Number((1.35 + Math.random() * 1.75).toFixed(2));
  if (r < 0.9) return Number((3.1 + Math.random() * 4.8).toFixed(2));
  return Number((8 + Math.random() * 12).toFixed(2));
};

const formatMoney = (value: number, currency: CurrencyType) => {
  if (currency === "star") return `⭐${Number(value.toFixed(2))}`;
  return `$${value.toFixed(2)}`;
};

const AviatorGame = () => {
  const navigate = useNavigate();
  const { dollarBalance, starBalance, dollarWinning, starWinning, refreshBalance } = useBalanceContext();
  const tgUser = getTelegramUser();

  const [currency, setCurrency] = useState<CurrencyType>("dollar");
  const [betAmount, setBetAmount] = useState(100);
  const [phase, setPhase] = useState<Phase>("betting");
  const [multiplier, setMultiplier] = useState(1);
  const [crashAt, setCrashAt] = useState(2);
  const [hasBet, setHasBet] = useState(false);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [history, setHistory] = useState<number[]>([1.28, 2.45, 8.71, 1.04, 3.23, 1.61, 5.92, 2.02, 1.19, 12.4]);

  const startTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const crashAudioRef = useRef<HTMLAudioElement | null>(null);
  const cashoutAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);

  const totalDollar = dollarBalance + dollarWinning;
  const totalStar = starBalance + starWinning;
  const balance = currency === "dollar" ? totalDollar : totalStar;
  const userName = tgUser?.first_name || tgUser?.username || "Player";

  const playSound = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => undefined);
  }, []);

  const unlockAudio = useCallback(() => {
    audioUnlockedRef.current = true;
    const bg = bgAudioRef.current;
    if (bg) {
      bg.volume = 0.28;
      bg.loop = true;
      bg.play().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    bgAudioRef.current = new Audio("/sounds/aviator/background.mp3");
    startAudioRef.current = new Audio("/sounds/aviator/game-start.mp3");
    crashAudioRef.current = new Audio("/sounds/aviator/plane-crash.mp3");
    cashoutAudioRef.current = new Audio("/sounds/aviator/cashout.mp3");

    return () => {
      [bgAudioRef, startAudioRef, crashAudioRef, cashoutAudioRef].forEach((ref) => {
        if (ref.current) {
          ref.current.pause();
          ref.current.src = "";
        }
      });
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase === "betting") {
      setMultiplier(1);
      setCashedOutAt(null);
      setCountdown(5);
      const tick = window.setInterval(() => {
        setCountdown((current) => {
          if (current <= 1) {
            window.clearInterval(tick);
            setCrashAt(generateCrashPoint());
            setPhase("flying");
            return 0;
          }
          return current - 1;
        });
      }, 1000);
      return () => window.clearInterval(tick);
    }

    if (phase === "flying") {
      if (audioUnlockedRef.current) playSound(startAudioRef.current);
      startTimeRef.current = performance.now();
      const animate = (now: number) => {
        const elapsed = (now - startTimeRef.current) / 1000;
        const nextMultiplier = Math.pow(1.075, elapsed * 1.8);
        if (nextMultiplier >= crashAt) {
          setMultiplier(crashAt);
          setPhase("crashed");
          return;
        }
        setMultiplier(nextMultiplier);
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    if (phase === "crashed") {
      playSound(crashAudioRef.current);
      if (hasBet && cashedOutAt === null) {
        toast.error(`FLEW AWAY @ ${crashAt.toFixed(2)}x — Bet lost`);
        reportGameResult({ betAmount, winAmount: 0, currency, game: "aviator" })
          .then(() => refreshBalance())
          .catch(() => undefined);
      }
      setHistory((items) => [Number(crashAt.toFixed(2)), ...items].slice(0, 18));
      const timeout = window.setTimeout(() => {
        setHasBet(false);
        setPhase("betting");
      }, 3000);
      return () => window.clearTimeout(timeout);
    }
  }, [betAmount, cashedOutAt, crashAt, currency, hasBet, phase, playSound, refreshBalance]);

  const progress = useMemo(() => {
    if (phase === "betting") return 0;
    return Math.min(Math.max(Math.pow((multiplier - 1) / 2.45, 0.58), 0.055), 0.97);
  }, [multiplier, phase]);

  const sX = 9;
  const sY = 86;
  const c1X = 32;
  const c1Y = 88;
  const c2X = 64;
  const c2Y = 36;
  const eX = 88;
  const eY = 15;
  const t = progress;
  const planeX = Math.pow(1 - t, 3) * sX + 3 * Math.pow(1 - t, 2) * t * c1X + 3 * (1 - t) * t * t * c2X + t * t * t * eX;
  const planeY = Math.pow(1 - t, 3) * sY + 3 * Math.pow(1 - t, 2) * t * c1Y + 3 * (1 - t) * t * t * c2Y + t * t * t * eY;
  const planeFrameIndex = Math.floor(multiplier * 8) % PLANE_FRAMES.length;

  const cp1xCur = sX + (c1X - sX) * t;
  const cp1yCur = sY + (c1Y - sY) * t;
  const cp2xCur = sX + (c1X - sX) * t + ((c2X - c1X) * t) * t;
  const cp2yCur = sY + (c1Y - sY) * t + ((c2Y - c1Y) * t) * t;
  const trailPath = `M ${sX} ${sY} C ${cp1xCur} ${cp1yCur}, ${cp2xCur} ${cp2yCur}, ${planeX} ${planeY}`;
  const trailFillPath = `${trailPath} L ${planeX} 91 L ${sX} 91 Z`;

  const displayedBets = useMemo(() => {
    const active: BetRow[] = hasBet
      ? [{ user: userName, amount: betAmount, multiplier: cashedOutAt, cashout: cashedOutAt ? betAmount * cashedOutAt : null }]
      : [];
    return [...active, ...seededRows];
  }, [betAmount, cashedOutAt, hasBet, userName]);

  const placeBet = () => {
    unlockAudio();
    if (phase !== "betting") return toast.error("Wait for next round");
    if (betAmount <= 0) return toast.error("Enter valid amount");
    if (betAmount > balance) return toast.error("Insufficient balance");
    setHasBet(true);
    toast.success(`Bet placed: ${formatMoney(betAmount, currency)}`);
  };

  const cashOut = useCallback(async () => {
    unlockAudio();
    if (phase !== "flying" || !hasBet || cashedOutAt !== null) return;
    const cashedAt = multiplier;
    const win = Number((betAmount * cashedAt).toFixed(2));
    setCashedOutAt(cashedAt);
    playSound(cashoutAudioRef.current);
    toast.success(`You have cashed out @ ${cashedAt.toFixed(2)}x — ${formatMoney(win, currency)}`);
    try {
      await reportGameResult({ betAmount, winAmount: win, currency, game: "aviator" });
      refreshBalance();
    } catch (error) {
      console.error(error);
    }
  }, [betAmount, cashedOutAt, currency, hasBet, multiplier, phase, playSound, refreshBalance, unlockAudio]);

  const roundColor = (value: number) => {
    if (value >= 10) return "hsl(280 88% 62%)";
    if (value >= 2) return "hsl(203 90% 58%)";
    return "hsl(0 74% 51%)";
  };

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground" style={{ fontFamily: "Roboto, Inter, sans-serif" }}>
      <audio preload="auto" src="/sounds/aviator/background.mp3" />
      <audio preload="auto" src="/sounds/aviator/game-start.mp3" />
      <audio preload="auto" src="/sounds/aviator/plane-crash.mp3" />
      <audio preload="auto" src="/sounds/aviator/cashout.mp3" />

      <header className="h-12 px-2 flex items-center justify-between border-b border-border bg-card">
        <button onClick={() => navigate("/")} className="h-9 flex items-center" aria-label="Home">
          <img src={logoImg} alt="Aviator" className="h-8 w-auto object-contain" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrency(currency === "dollar" ? "star" : "dollar")}
            className="h-8 min-w-28 px-2 rounded-full flex items-center justify-between gap-2 bg-muted border border-border text-sm font-bold"
          >
            <span>{currency === "dollar" ? totalDollar.toFixed(2) : Number(totalStar.toFixed(2))}</span>
            <span className="rounded-full px-2 py-0.5 bg-primary text-primary-foreground text-[11px]">{currency === "dollar" ? "$" : "⭐"}</span>
          </button>
          <button onClick={() => navigate("/wallet")} className="h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center" aria-label="Wallet">
            <Plus className="h-4 w-4" />
          </button>
          <button className="h-8 w-8 rounded-full bg-muted grid place-items-center" aria-label="Menu">
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="h-[calc(100dvh-48px)] min-h-0 grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-1 lg:gap-2 p-0 lg:p-2 bg-background">
        <aside className="hidden lg:flex flex-col rounded-lg bg-card border border-border overflow-hidden">
          <div className="h-11 grid grid-cols-2 text-sm font-bold border-b border-border">
            <button className="relative text-foreground">All Bets<span className="absolute left-5 right-5 bottom-0 h-0.5 bg-primary" /></button>
            <button className="text-muted-foreground">My Bets</button>
          </div>
          <div className="p-2 flex items-center justify-between text-xs font-bold">
            <span>TOTAL BETS : <span className="text-primary">{displayedBets.length}</span></span>
            <button className="px-2 py-1 rounded bg-muted text-muted-foreground">Previous hand</button>
          </div>
          <div className="grid grid-cols-[1.3fr_.7fr_.7fr_1fr] px-3 py-2 text-[11px] text-muted-foreground bg-muted font-bold">
            <span>User</span><span>Bet</span><span>Mult.</span><span>Cash out</span>
          </div>
          <div className="flex-1 overflow-hidden">
            {displayedBets.map((row, index) => (
              <div key={`${row.user}-${index}`} className="grid grid-cols-[1.3fr_.7fr_.7fr_1fr] items-center px-3 py-2 text-xs border-b border-border/70">
                <span className="font-semibold">{row.user}</span>
                <span>{row.amount}</span>
                <span className={row.multiplier ? "text-primary font-bold" : "text-muted-foreground"}>{row.multiplier ? `${row.multiplier.toFixed(2)}x` : "-"}</span>
                <span className={row.cashout ? "text-primary font-bold" : "text-muted-foreground"}>{row.cashout ? row.cashout.toFixed(2) : "-"}</span>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0 flex flex-col gap-1 lg:gap-2 overflow-hidden">
          <div className="h-9 flex items-center justify-between lg:rounded-lg bg-card border-y lg:border border-border px-2">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {history.map((item, index) => (
                <span key={`${item}-${index}`} className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold bg-muted" style={{ color: roundColor(item) }}>
                  {item.toFixed(2)}x
                </span>
              ))}
            </div>
            <button className="ml-2 shrink-0 h-7 px-2 rounded bg-muted text-xs font-bold flex items-center gap-1 text-muted-foreground">
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          <div className="relative min-h-[310px] flex-1 lg:rounded-lg lg:border lg:border-border overflow-hidden bg-card">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,_hsl(280_85%_45%)_0%,_hsl(220_90%_30%)_45%,_hsl(260_80%_15%)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_75%,_hsl(330_90%_55%/0.55)_0%,_transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_85%,_hsl(190_95%_55%/0.45)_0%,_transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,_hsl(45_100%_60%/0.35)_0%,_transparent_45%)]" />
            
            {phase !== "betting" && (
              <div className="absolute left-5 right-6 bottom-6 top-7 pointer-events-none">
                <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="aviatorStroke" x1="0" y1="1" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(350 100% 45%)" />
                      <stop offset="100%" stopColor="hsl(350 100% 58%)" />
                    </linearGradient>
                    <linearGradient id="aviatorFill" x1="0" y1="1" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(350 100% 45% / 0.08)" />
                      <stop offset="100%" stopColor="hsl(350 100% 45% / 0.34)" />
                    </linearGradient>
                  </defs>
                  <path d={trailFillPath} fill="url(#aviatorFill)" />
                  <path d={trailPath} stroke="url(#aviatorStroke)" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>

                <div
                  className="absolute z-30 pointer-events-none"
                  style={{ left: `${planeX}%`, top: `${planeY}%`, transform: "translate(-44%, -105%)" }}
                >
                  <motion.div
                    className="relative h-6 w-12 sm:h-8 sm:w-16 lg:h-10 lg:w-20 xl:h-12 xl:w-24"
                    animate={phase === "crashed" ? { x: 18, y: -16, opacity: 1, scale: 0.78 } : { x: 0, y: 0, opacity: 1, scale: 1 }}
                    transition={{ duration: phase === "crashed" ? 1.05 : 0.05, ease: "easeOut" }}
                  >
                    {PLANE_FRAMES.map((frame, index) => (
                      <img
                        key={frame}
                        src={frame}
                        alt=""
                        className={`absolute inset-0 h-full w-full object-contain ${index === planeFrameIndex ? "opacity-100" : "opacity-0"} ${phase === "crashed" ? "drop-shadow-[0_0_18px_hsl(0_85%_55%)]" : "drop-shadow-[0_0_14px_hsl(45_100%_55%)]"}`}
                      />
                    ))}
                  </motion.div>
                </div>
              </div>
            )}

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {phase === "betting" ? (
                <div className="text-center px-4">
                  <img src={planeImg} alt="" className="mx-auto h-20 w-20 object-contain mb-3 opacity-95" />
                  <div className="text-2xl sm:text-4xl font-black tracking-wide text-foreground">WAITING FOR NEXT ROUND</div>
                  <div className="mx-auto mt-4 h-1.5 w-64 max-w-[72vw] rounded-full overflow-hidden bg-muted">
                    <motion.div
                      key={countdown}
                      className="h-full bg-primary"
                      initial={{ width: "100%" }}
                      animate={{ width: `${(countdown / 5) * 100}%` }}
                      transition={{ duration: 0.35 }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  {phase === "crashed" && <div className="text-2xl sm:text-4xl font-black text-destructive mb-1">FLEW AWAY!</div>}
                  <div className="font-game text-6xl sm:text-8xl leading-none font-black text-foreground text-glow">
                    {multiplier.toFixed(2)}<span className="text-4xl sm:text-6xl">X</span>
                  </div>
                </div>
              )}
            </div>

            <img src={rotateBg} alt="" className="absolute -right-24 -bottom-32 h-[420px] w-[420px] max-w-none opacity-40 animate-spin pointer-events-none" style={{ animationDuration: "18s" }} />

            {phase === "betting" && (
              <div className="absolute left-4 bottom-6 pointer-events-none">
                <img src={staticPlane} alt="" className="h-14 w-24 object-contain" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <BetPanel
              title="BET"
              betAmount={betAmount}
              setBetAmount={setBetAmount}
              phase={phase}
              hasBet={hasBet}
              cashedOutAt={cashedOutAt}
              multiplier={multiplier}
              placeBet={placeBet}
              cashOut={cashOut}
              currency={currency}
            />
            <BetPanel
              title="AUTO"
              betAmount={betAmount}
              setBetAmount={setBetAmount}
              phase={phase}
              hasBet={hasBet}
              cashedOutAt={cashedOutAt}
              multiplier={multiplier}
              placeBet={placeBet}
              cashOut={cashOut}
              currency={currency}
              muted
            />
          </div>

          <nav className="h-14 grid grid-cols-4 rounded-lg bg-card border border-border lg:hidden">
            {[
              { icon: PlaneNavIcon, label: "Aviator", active: true },
              { icon: ClipboardList, label: "My Bets" },
              { icon: Trophy, label: "Top" },
              { icon: MessageCircle, label: "Chat" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.label} className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-muted-foreground data-[active=true]:text-primary" data-active={item.active}>
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </section>
      </main>
    </div>
  );
};

const BetPanel = ({
  title,
  betAmount,
  setBetAmount,
  phase,
  hasBet,
  cashedOutAt,
  multiplier,
  placeBet,
  cashOut,
  currency,
  muted = false,
}: {
  title: string;
  betAmount: number;
  setBetAmount: (value: number) => void;
  phase: Phase;
  hasBet: boolean;
  cashedOutAt: number | null;
  multiplier: number;
  placeBet: () => void;
  cashOut: () => void;
  currency: CurrencyType;
  muted?: boolean;
}) => {
  const canCashOut = phase === "flying" && hasBet && cashedOutAt === null;
  const isWaiting = hasBet && phase === "betting";
  const value = muted ? Math.max(10, Math.round(betAmount / 2)) : betAmount;

  const setValue = (next: number) => {
    if (!muted) setBetAmount(Math.max(1, next));
  };

  return (
    <div className="rounded-lg border border-border bg-card p-2">
      <div className="h-8 flex items-center justify-center mb-2">
        <div className="h-7 w-44 rounded-full bg-background p-0.5 grid grid-cols-2 text-xs font-bold">
          <button className="rounded-full bg-muted text-foreground">{title}</button>
          <button className="rounded-full text-muted-foreground">Auto</button>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1.05fr] gap-2 items-stretch">
        <div className="min-w-0">
          <div className="h-10 rounded-full bg-background border border-border flex items-center overflow-hidden">
            <input
              value={value.toFixed(2)}
              disabled={muted}
              onChange={(event) => setValue(Number(event.target.value.replace(/[^0-9.]/g, "")) || 0)}
              className="w-full min-w-0 bg-transparent px-3 text-center font-bold text-lg outline-none disabled:opacity-70"
              inputMode="decimal"
            />
            <div className="grid grid-cols-2 h-full border-l border-border">
              <button onClick={() => setValue(value - 10)} className="w-9 grid place-items-center bg-muted text-xl font-bold" disabled={muted}>-</button>
              <button onClick={() => setValue(value + 10)} className="w-9 grid place-items-center bg-muted text-xl font-bold" disabled={muted}>+</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {PRESETS.map((amount) => (
              <button
                key={`${title}-${amount}`}
                disabled={muted}
                onClick={() => setValue(amount)}
                className="h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold disabled:opacity-70"
              >
                {amount}<span className="text-[10px]">{currency === "dollar" ? "$" : "⭐"}</span>
              </button>
            ))}
          </div>
        </div>

        {canCashOut ? (
          <button onClick={cashOut} disabled={muted} className="rounded-xl bg-primary text-primary-foreground font-game text-xl leading-tight flex flex-col items-center justify-center disabled:opacity-70">
            <span>CASH OUT</span>
            <span className="text-base font-sans font-black">{(value * multiplier).toFixed(2)}</span>
          </button>
        ) : cashedOutAt ? (
          <div className="rounded-xl bg-primary text-primary-foreground font-game text-lg flex flex-col items-center justify-center opacity-90">
            <span>CASHED</span>
            <span className="text-sm">{cashedOutAt.toFixed(2)}x</span>
          </div>
        ) : (
          <button
            onClick={placeBet}
            disabled={muted || isWaiting || phase !== "betting"}
            className="rounded-xl bg-[hsl(104_82%_39%)] text-foreground font-game text-2xl leading-tight flex flex-col items-center justify-center shadow-[inset_0_-3px_0_hsl(104_80%_28%)] disabled:opacity-70"
          >
            <span>{isWaiting ? "CANCEL" : "BET"}</span>
            <span className="text-base font-sans font-black">{value.toFixed(2)}</span>
          </button>
        )}
      </div>
    </div>
  );
};

const PlaneNavIcon = (props: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M2 12 L20 8 L12 12.5 Z" />
    <path d="M2 12 L20 8 L11 16 Z" opacity="0.7" />
  </svg>
);

export default AviatorGame;
