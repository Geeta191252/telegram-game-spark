import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ShoppingCart, User, Shield, Sparkles, Flame, X, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBalanceContext } from "@/contexts/BalanceContext";
import { getTelegramUser } from "@/lib/telegram";
import BottomNav from "./BottomNav";
import EarnScreen from "./EarnScreen";
import FriendsScreen from "./FriendsScreen";
import WalletScreen from "./WalletScreen";
import MarketScreen from "./MarketScreen";
import TournamentLeaderboard, { Tournament } from "./TournamentLeaderboard";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://broken-bria-chetan1-ea890b93.koyeb.app/api";

type FilterTab = "all" | "tournament" | "wheel" | "crash" | "slots";

import greedyKingThumb from "@/assets/greedy-king-thumb.png";
import gameDice from "@/assets/game-dice.jpg";
import gameCarnivalSpin from "@/assets/game-carnival-spin.jpg";
import gameMines from "@/assets/game-mines.jpg";
import gameAviator from "@/assets/game-aviator.jpg";
import gamePlinko from "@/assets/game-plinko.jpg";
import gameChickenRoad from "@/assets/game-chicken-road.jpg";
import gameDragonTiger from "@/assets/game-dragon-tiger.jpg";
import homeBg from "@/assets/home-bg.png";

interface GameTileProps {
  image: string;
  name: string;
  description: string;
  badge?: string;
  badgeGradient?: string;
  borderGradient?: string;
  glowColor?: string;
  delay?: number;
  onClick?: () => void;
}

const GameTile = ({ image, name, description, badge, badgeGradient, borderGradient, glowColor, delay = 0, onClick }: GameTileProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay, duration: 0.4, type: "spring", stiffness: 120 }}
    whileTap={{ scale: 0.9 }}
    whileHover={{ scale: 1.05, y: -4 }}
    onClick={onClick}
    className="cursor-pointer w-full"
  >
    <div className="relative rounded-2xl overflow-hidden aspect-square mb-2" style={{
      padding: "2px",
      background: borderGradient || "linear-gradient(135deg, hsl(280 70% 60%), hsl(320 60% 50%), hsl(45 80% 55%))",
      boxShadow: `0 8px 30px ${glowColor || "hsla(280, 60%, 50%, 0.4)"}, 0 0 20px ${glowColor || "hsla(280, 60%, 50%, 0.2)"}`,
    }}>
      <div className="w-full h-full rounded-2xl overflow-hidden relative">
        <img src={image} alt={name} className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, transparent 50%, hsla(0,0%,0%,0.6) 100%)"
        }} />
        {badge && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: (delay || 0) + 0.2, type: "spring", stiffness: 200 }}
            className="absolute top-2 left-2 text-white text-[10px] font-black px-3 py-1 rounded-full"
            style={{
              background: badgeGradient || "linear-gradient(135deg, hsl(140 70% 45%), hsl(160 60% 40%))",
              boxShadow: "0 2px 8px hsla(0, 0%, 0%, 0.3)",
            }}
          >
            {badge}
          </motion.span>
        )}
      </div>
    </div>
    <h4 className="font-bold text-sm truncate" style={{ color: "hsl(0 0% 98%)" }}>{name}</h4>
    <p className="text-[11px] truncate" style={{ color: "hsl(260 40% 75%)" }}>{description}</p>
  </motion.div>
);

const HomeScreen = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const { dollarBalance, starBalance, dollarWinning, starWinning } = useBalanceContext();
  const totalDollar = dollarBalance + dollarWinning;
  const totalStar = starBalance + starWinning;
  const [filter, setFilter] = useState<FilterTab>("all");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [openTournament, setOpenTournament] = useState<Tournament | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Only tick the countdown clock when there are tournaments with endsAt.
    // Without this gate, every HomeScreen child re-renders every second on Android → flicker.
    const hasTimedTournament = tournaments.some((t) => !!t.endsAt);
    if (!hasTimedTournament) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [tournaments]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/tournaments/active`)
      .then((r) => r.ok ? r.json() : { tournaments: [] })
      .then((d) => setTournaments(d.tournaments || []))
      .catch(() => {});
  }, []);

  const formatRemaining = (ms: number) => {
    if (ms <= 0) return "Ended";
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    return `${m}m ${sec}s`;
  };

  const goToGreedyKing = () => navigate("/greedy-king");
  const goToDiceMaster = () => navigate("/dice-master");
  const goToCarnivalSpin = () => navigate("/carnival-spin");
  const goToMines = () => navigate("/mines");
  const goToAviator = () => navigate("/aviator");
  const goToPlinko = () => navigate("/plinko");
  const goToChickenRoad = () => navigate("/chicken-road");
  const goToDragonTiger = () => navigate("/dragon-tiger");
  const goToAdmin = () => navigate("/admin");

  const telegramUser = getTelegramUser();
  const isOwner = telegramUser?.id === 6965488457;

  const renderTabContent = () => {
    switch (activeTab) {
      case 1: return <MarketScreen onGoToWallet={() => setActiveTab(4)} />;
      case 2: return <EarnScreen />;
      case 3: return <FriendsScreen />;
      case 4: return <WalletScreen />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen pb-20 relative">
      {/* Background image */}
      <div className="fixed inset-0 z-0">
        <img src={homeBg} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, hsla(280, 60%, 10%, 0.7) 0%, hsla(300, 50%, 8%, 0.6) 50%, hsla(260, 55%, 12%, 0.8) 100%)",
        }} />
      </div>

      {/* Static decorative sparkles — no infinite framer-motion to avoid Android repaint flicker */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[1]">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-50"
            style={{
              width: `${4 + i * 2}px`,
              height: `${4 + i * 2}px`,
              top: `${15 + i * 20}%`,
              left: `${10 + i * 22}%`,
              background: `radial-gradient(circle, hsla(${40 + i * 30}, 90%, 70%, 0.7), transparent)`,
            }}
          />
        ))}
      </div>

      {/* Top Bar — solid bg (no backdrop-blur) for smooth Android scroll */}
      <div className="sticky top-0 z-30 px-2 py-1.5 flex items-center justify-between gap-1.5" style={{
        background: "linear-gradient(135deg, hsl(265, 55%, 22%) 0%, hsl(280, 50%, 19%) 100%)",
        borderBottom: "1px solid hsla(45, 80%, 55%, 0.15)",
        boxShadow: "0 4px 18px hsla(260, 50%, 8%, 0.5)",
      }}>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {/* Dollar badge (static shadow) */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1 rounded-full px-2 py-1 shrink-0 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(140 65% 42%), hsl(160 55% 38%))",
              boxShadow: "0 0 10px hsla(140,60%,45%,0.4)",
            }}
          >
            <span className="text-[10px] font-black" style={{ color: "hsl(0 0% 100%)" }}>💲</span>
            <span className="font-bold text-[10px]" style={{ color: "hsl(0 0% 100%)" }}>
              {totalDollar.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </motion.div>
          {/* Star badge (static shadow) */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1 rounded-full px-2 py-1 shrink-0 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(40 90% 50%), hsl(25 85% 45%))",
              boxShadow: "0 0 10px hsla(40,90%,55%,0.4)",
            }}
          >
            <span className="text-[10px]">⭐</span>
            <span className="font-bold text-[10px]" style={{ color: "hsl(0 0% 10%)" }}>
              {totalStar.toLocaleString()}
            </span>
          </motion.div>
        </div>
        <div className="flex items-center gap-1.5">
          {isOwner && (
            <motion.div
              whileTap={{ scale: 0.9 }}
              onClick={goToAdmin}
              className="h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer"
              style={{
                background: "linear-gradient(135deg, hsl(0 75% 55%), hsl(25 85% 50%))",
                boxShadow: "0 2px 8px hsla(0, 70%, 50%, 0.4)",
              }}
            >
              <Shield className="h-3.5 w-3.5" style={{ color: "hsl(0 0% 100%)" }} />
            </motion.div>
          )}
          <motion.div
            whileTap={{ scale: 0.9 }}
            className="h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(310 65% 55%), hsl(280 55% 50%))",
              boxShadow: "0 2px 8px hsla(310, 60%, 50%, 0.4)",
            }}
          >
            <ShoppingCart className="h-3.5 w-3.5" style={{ color: "hsl(0 0% 100%)" }} />
          </motion.div>
          <motion.div
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowProfile(true)}
            className="h-7 w-7 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer"
            style={{
              border: "2px solid hsl(45 85% 60%)",
              background: "linear-gradient(135deg, hsl(45 75% 55%), hsl(30 65% 45%))",
              boxShadow: "0 2px 8px hsla(45, 80%, 55%, 0.4)",
            }}
          >
            <User className="h-3.5 w-3.5" style={{ color: "hsl(0 0% 10%)" }} />
          </motion.div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 0 ? (
          <motion.div key="games" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="relative z-10">
            <div className="px-4 space-y-5 mt-4">

              {/* 🔥 Hot Games Banner */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl p-3 flex items-center gap-3"
                style={{
                  background: "linear-gradient(135deg, hsl(0, 50%, 22%), hsl(45, 45%, 20%), hsl(280, 45%, 22%))",
                  border: "1px solid hsla(45, 70%, 55%, 0.2)",
                }}
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Flame className="h-8 w-8" style={{ color: "hsl(25 90% 55%)" }} />
                </motion.div>
                <div>
                  <h3 className="font-bold text-sm" style={{ color: "hsl(45 90% 70%)" }}>Play & Win Real Rewards!</h3>
                  <p className="text-[11px]" style={{ color: "hsl(260 30% 70%)" }}>Choose your favorite game below</p>
                </div>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="ml-auto"
                >
                  <Sparkles className="h-5 w-5" style={{ color: "hsl(45 90% 60%)" }} />
                </motion.div>
              </motion.div>

              {/* Filter chips */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                {([
                  { key: "all", label: "All", emoji: "🎮" },
                  { key: "tournament", label: "Tournament", emoji: "🏆" },
                  { key: "wheel", label: "Wheel", emoji: "🎡" },
                  { key: "crash", label: "Crash", emoji: "🚀" },
                  { key: "slots", label: "Slots", emoji: "🎰" },
                ] as { key: FilterTab; label: string; emoji: string }[]).map((c) => {
                  const active = filter === c.key;
                  return (
                    <motion.button
                      key={c.key}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setFilter(c.key)}
                      className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition-all"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, hsl(280 75% 55%), hsl(310 70% 50%))"
                          : "hsla(260, 40%, 25%, 0.6)",
                        color: active ? "hsl(0 0% 100%)" : "hsl(260 30% 75%)",
                        border: active
                          ? "1px solid hsla(45, 80%, 55%, 0.5)"
                          : "1px solid hsla(260, 40%, 40%, 0.3)",
                        boxShadow: active ? "0 4px 14px hsla(280, 70%, 50%, 0.4)" : "none",
                      }}
                    >
                      <span>{c.emoji}</span>{c.label}
                    </motion.button>
                  );
                })}
              </div>

              {/* Tournament Section */}
              {(filter === "all" || filter === "tournament") && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <motion.h2 initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="font-game text-lg flex items-center gap-2">
                      <Trophy className="h-5 w-5" style={{ color: "hsl(45 95% 60%)" }} />
                      <span style={{
                        background: "linear-gradient(135deg, hsl(45 95% 65%), hsl(280 70% 60%))",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                      }}>Tournament</span>
                    </motion.h2>
                  </div>
                  {tournaments.length === 0 ? (
                    <div className="rounded-2xl p-4 text-center text-xs" style={{
                      background: "hsla(260,40%,25%,0.4)", border: "1px dashed hsla(45,80%,55%,0.25)", color: "hsl(260 30% 70%)"
                    }}>
                      No tournaments active right now. Coming soon! 🏆
                    </div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                       {tournaments.map((t) => {
                        const sym = t.prizeCurrency === "dollar" ? "$" : "⭐";
                        const firstPrize = t.prizeTiers && t.prizeTiers.length > 0 ? t.prizeTiers[0].amount : t.prizePerWinner;
                        const remainingMs = t.endsAt ? new Date(t.endsAt).getTime() - now : 0;
                        return (
                          <motion.div
                            key={t._id}
                            whileTap={{ scale: 0.95 }}
                            whileHover={{ scale: 1.03 }}
                            onClick={() => setOpenTournament(t)}
                            className="cursor-pointer flex-shrink-0 w-[210px] rounded-2xl overflow-hidden relative"
                            style={{
                              background: "linear-gradient(180deg, hsla(280,70%,30%,0.6), hsla(260,60%,15%,0.8))",
                              border: "1.5px solid hsla(45,80%,55%,0.4)",
                              boxShadow: "0 8px 24px hsla(280,60%,30%,0.4)",
                            }}
                          >
                            <div className="aspect-[16/10] relative overflow-hidden">
                              {t.imageUrl ? (
                                <img src={t.imageUrl} alt={t.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center" style={{
                                  background: "linear-gradient(135deg, hsl(280 60% 35%), hsl(45 70% 45%))"
                                }}>
                                  <Trophy className="h-12 w-12" style={{ color: "hsl(45 95% 70%)" }} />
                                </div>
                              )}
                              <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[10px] font-black" style={{
                                background: "linear-gradient(135deg, hsl(0 80% 50%), hsl(25 80% 45%))",
                                color: "white",
                              }}>TOP {t.tier}</div>
                              {t.endsAt && (
                                <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1" style={{
                                  background: "hsla(0,0%,0%,0.65)",
                                  color: remainingMs > 0 ? "hsl(140 80% 70%)" : "hsl(0 80% 70%)",
                                  backdropFilter: "blur(4px)",
                                }}>
                                  ⏱ {formatRemaining(remainingMs)}
                                </div>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="text-xs font-bold truncate" style={{ color: "hsl(0 0% 95%)" }}>{t.title}</p>
                              <p className="text-[11px] mt-0.5" style={{ color: "hsl(45 90% 65%)" }}>
                                1st Prize: <span className="font-black">{sym}{firstPrize}</span>
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* Wheel Category */}
              {(filter === "all" || filter === "wheel") && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <motion.h2
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    className="font-game text-lg flex items-center gap-2"
                  >
                    <span className="text-xl">🎡</span>
                    <span style={{
                      background: "linear-gradient(135deg, hsl(45 95% 65%), hsl(35 90% 55%), hsl(20 85% 50%))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      filter: "drop-shadow(0 0 8px hsla(45, 90%, 55%, 0.5))",
                    }}>Wheel</span>
                  </motion.h2>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setFilter("wheel")}
                    className="flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1"
                    style={{
                      background: "hsla(45, 70%, 55%, 0.15)",
                      color: "hsl(45 80% 65%)",
                      border: "1px solid hsla(45, 70%, 55%, 0.25)",
                    }}
                  >
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </motion.button>
                </div>
                <div className="grid grid-cols-2 gap-3 pb-2">
                  <GameTile
                    image={greedyKingThumb}
                    name="Greedy King"
                    description="Win more than FruitMachine"
                    badge="🔥 HOT"
                    badgeGradient="linear-gradient(135deg, hsl(25 90% 50%), hsl(0 80% 50%))"
                    borderGradient="linear-gradient(135deg, hsl(45 90% 55%), hsl(25 85% 50%), hsl(0 80% 55%))"
                    glowColor="hsla(45, 90%, 55%, 0.35)"
                    delay={0.1}
                    onClick={goToGreedyKing}
                  />
                </div>
              </section>
              )}

              {/* Colorful Divider */}
              {filter === "all" && (
              <div className="h-[2px] rounded-full" style={{
                background: "linear-gradient(90deg, transparent, hsl(280 60% 55%), hsl(45 80% 55%), hsl(0 70% 55%), transparent)",
              }} />
              )}

              {/* Crash Category */}
              {(filter === "all" || filter === "crash") && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <motion.h2
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    className="font-game text-lg flex items-center gap-2"
                  >
                    <span className="text-xl">🚀</span>
                    <span style={{
                      background: "linear-gradient(135deg, hsl(310 80% 65%), hsl(280 70% 60%), hsl(45 90% 60%))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      filter: "drop-shadow(0 0 8px hsla(310, 80%, 60%, 0.5))",
                    }}>Crash</span>
                  </motion.h2>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setFilter("crash")}
                    className="flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1"
                    style={{
                      background: "hsla(310, 70%, 55%, 0.15)",
                      color: "hsl(310 80% 75%)",
                      border: "1px solid hsla(310, 70%, 55%, 0.25)",
                    }}
                  >
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </motion.button>
                </div>
                <div className="grid grid-cols-2 gap-3 pb-2">
                  <GameTile
                    image={gameAviator}
                    name="Aviator"
                    description="Cash out before crash!"
                    badge="🚀 NEW"
                    badgeGradient="linear-gradient(135deg, hsl(310 75% 55%), hsl(280 65% 50%))"
                    borderGradient="linear-gradient(135deg, hsl(310 80% 60%), hsl(280 70% 55%), hsl(45 85% 55%))"
                    glowColor="hsla(310, 80%, 55%, 0.4)"
                    delay={0.1}
                    onClick={goToAviator}
                  />
                  <GameTile
                    image={gameChickenRoad}
                    name="Chicken Road"
                    description="Cross lanes, dodge cars!"
                    badge="🐔 NEW"
                    badgeGradient="linear-gradient(135deg, hsl(25 90% 50%), hsl(45 90% 55%))"
                    borderGradient="linear-gradient(135deg, hsl(25 90% 55%), hsl(45 90% 55%), hsl(0 80% 55%))"
                    glowColor="hsla(25, 90%, 55%, 0.4)"
                    delay={0.15}
                    onClick={goToChickenRoad}
                  />
                </div>
              </section>
              )}

              {/* Colorful Divider */}
              {filter === "all" && (
              <div className="h-[2px] rounded-full" style={{
                background: "linear-gradient(90deg, transparent, hsl(280 60% 55%), hsl(45 80% 55%), hsl(0 70% 55%), transparent)",
              }} />
              )}
              {(filter === "all" || filter === "slots") && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <motion.h2
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
                    className="font-game text-lg flex items-center gap-2"
                  >
                    <span className="text-xl">🎰</span>
                    <span style={{
                      background: "linear-gradient(135deg, hsl(0 80% 60%), hsl(330 75% 55%), hsl(300 65% 55%))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      filter: "drop-shadow(0 0 8px hsla(0, 80%, 55%, 0.5))",
                    }}>Slots</span>
                  </motion.h2>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setFilter("slots")}
                    className="flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1"
                    style={{
                      background: "hsla(0, 70%, 55%, 0.15)",
                      color: "hsl(0 70% 70%)",
                      border: "1px solid hsla(0, 70%, 55%, 0.25)",
                    }}
                  >
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </motion.button>
                </div>
                <div className="grid grid-cols-2 gap-3 pb-2">
                  <GameTile
                    image={gameDice}
                    name="Dice Master"
                    description="Roll to earn coins"
                    badge="⚡ New"
                    badgeGradient="linear-gradient(135deg, hsl(140 70% 45%), hsl(170 65% 40%))"
                    borderGradient="linear-gradient(135deg, hsl(140 65% 50%), hsl(200 70% 55%), hsl(170 60% 45%))"
                    glowColor="hsla(140, 65%, 50%, 0.35)"
                    delay={0.1}
                    onClick={goToDiceMaster}
                  />
                  <GameTile
                    image={gameCarnivalSpin}
                    name="Carnival Spin"
                    description="Win prizes daily"
                    badge="🎪 Fun"
                    badgeGradient="linear-gradient(135deg, hsl(280 65% 55%), hsl(310 60% 50%))"
                    borderGradient="linear-gradient(135deg, hsl(280 65% 55%), hsl(310 60% 55%), hsl(340 65% 55%))"
                    glowColor="hsla(280, 65%, 55%, 0.35)"
                    delay={0.15}
                    onClick={goToCarnivalSpin}
                  />
                  <GameTile
                    image={gameMines}
                    name="Mines"
                    description="Avoid the bombs!"
                    badge="💣 Risk"
                    badgeGradient="linear-gradient(135deg, hsl(0 75% 50%), hsl(330 70% 45%))"
                    borderGradient="linear-gradient(135deg, hsl(0 70% 55%), hsl(320 60% 50%), hsl(280 55% 50%))"
                    glowColor="hsla(0, 70%, 55%, 0.35)"
                    delay={0.2}
                    onClick={goToMines}
                  />
                  <GameTile
                    image={gamePlinko}
                    name="Plinko"
                    description="Drop the ball, win big!"
                    badge="🎪 NEW"
                    badgeGradient="linear-gradient(135deg, hsl(45 90% 55%), hsl(15 85% 50%))"
                    borderGradient="linear-gradient(135deg, hsl(45 90% 60%), hsl(15 85% 55%), hsl(310 70% 55%))"
                    glowColor="hsla(45, 90%, 55%, 0.4)"
                    delay={0.25}
                    onClick={goToPlinko}
                  />
                </div>
              </section>
              )}

            </div>
          </motion.div>
        ) : (
          <motion.div key={`tab-${activeTab}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="relative z-10">
            {renderTabContent()}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      <AnimatePresence>
        {openTournament && (
          <TournamentLeaderboard tournament={openTournament} onClose={() => setOpenTournament(null)} />
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            style={{ background: "hsla(260, 50%, 10%, 0.8)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowProfile(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[300px] rounded-3xl p-5 relative"
              style={{
                background: "linear-gradient(160deg, hsl(265 55% 28%), hsl(280 45% 20%))",
                border: "1.5px solid hsla(45, 80%, 55%, 0.25)",
                boxShadow: "0 20px 60px hsla(260, 50%, 10%, 0.7), 0 0 30px hsla(45, 80%, 55%, 0.1)",
              }}
            >
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowProfile(false)}
                className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center"
                style={{ background: "hsla(0, 0%, 100%, 0.1)" }}
              >
                <X className="h-4 w-4" style={{ color: "hsl(0 0% 80%)" }} />
              </motion.button>

              <div className="flex flex-col items-center gap-3">
                <motion.div
                  animate={{ boxShadow: ["0 0 15px hsla(45,80%,55%,0.3)", "0 0 25px hsla(45,80%,55%,0.5)", "0 0 15px hsla(45,80%,55%,0.3)"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="h-16 w-16 rounded-2xl flex items-center justify-center"
                  style={{
                    border: "2.5px solid hsl(45 85% 60%)",
                    background: "linear-gradient(135deg, hsl(45 75% 55%), hsl(30 65% 45%))",
                  }}
                >
                  <User className="h-8 w-8" style={{ color: "hsl(0 0% 10%)" }} />
                </motion.div>

                <div className="text-center space-y-1">
                  <h3 className="font-bold text-base" style={{ color: "hsl(0 0% 95%)" }}>
                    {telegramUser?.first_name || "User"} {telegramUser?.last_name || ""}
                  </h3>
                  {telegramUser?.username && (
                    <p className="text-xs" style={{ color: "hsl(260 40% 75%)" }}>@{telegramUser.username}</p>
                  )}
                </div>

                <div className="w-full rounded-xl p-3 mt-1 space-y-2" style={{
                  background: "hsla(0, 0%, 100%, 0.06)",
                  border: "1px solid hsla(0, 0%, 100%, 0.08)",
                }}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium" style={{ color: "hsl(260 30% 70%)" }}>Telegram ID</span>
                    <span className="text-xs font-bold" style={{ color: "hsl(45 80% 65%)" }}>{telegramUser?.id || "N/A"}</span>
                  </div>
                  <div className="h-px" style={{ background: "hsla(0, 0%, 100%, 0.08)" }} />
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium" style={{ color: "hsl(260 30% 70%)" }}>💲 Balance</span>
                    <span className="text-xs font-bold" style={{ color: "hsl(140 60% 55%)" }}>{totalDollar.toFixed(2)}</span>
                  </div>
                  <div className="h-px" style={{ background: "hsla(0, 0%, 100%, 0.08)" }} />
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium" style={{ color: "hsl(260 30% 70%)" }}>⭐ Stars</span>
                    <span className="text-xs font-bold" style={{ color: "hsl(40 90% 55%)" }}>{totalStar.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomeScreen;
