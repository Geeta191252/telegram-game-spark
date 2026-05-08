import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ShoppingCart, User, Shield, Sparkles, Flame, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBalanceContext } from "@/contexts/BalanceContext";
import { getTelegramUser } from "@/lib/telegram";
import BottomNav from "./BottomNav";
import EarnScreen from "./EarnScreen";
import FriendsScreen from "./FriendsScreen";
import WalletScreen from "./WalletScreen";

import greedyKingThumb from "@/assets/greedy-king-thumb.png";
import gameDice from "@/assets/game-dice.jpg";
import gameCarnivalSpin from "@/assets/game-carnival-spin.jpg";
import gameMines from "@/assets/game-mines.jpg";
import gameAviator from "@/assets/game-aviator.jpg";
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
    className="cursor-pointer flex-shrink-0 w-[150px]"
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
  const goToGreedyKing = () => navigate("/greedy-king");
  const goToDiceMaster = () => navigate("/dice-master");
  const goToCarnivalSpin = () => navigate("/carnival-spin");
  const goToMines = () => navigate("/mines");
  const goToAviator = () => navigate("/aviator");
  const goToAdmin = () => navigate("/admin");

  const telegramUser = getTelegramUser();
  const isOwner = telegramUser?.id === 6965488457;

  const renderTabContent = () => {
    switch (activeTab) {
      case 1: return (
        <div className="relative z-10 px-6 pt-20 pb-32 text-center">
          <div className="text-6xl mb-4">🏪</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: "hsl(45 90% 65%)" }}>Market</h2>
          <p className="text-sm" style={{ color: "hsl(260 30% 75%)" }}>Coming soon — exclusive items & rewards!</p>
        </div>
      );
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

      {/* Animated sparkle particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[1]">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -20, 10, 0],
              x: [0, 10, -10, 0],
              opacity: [0.3, 0.8, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.5 }}
            className="absolute rounded-full"
            style={{
              width: `${4 + i * 2}px`,
              height: `${4 + i * 2}px`,
              top: `${15 + i * 14}%`,
              left: `${10 + i * 15}%`,
              background: `radial-gradient(circle, hsla(${40 + i * 30}, 90%, 70%, 0.8), transparent)`,
              boxShadow: `0 0 ${8 + i * 3}px hsla(${40 + i * 30}, 90%, 60%, 0.5)`,
            }}
          />
        ))}
      </div>

      {/* Top Bar */}
      <div className="sticky top-0 z-30 px-3 py-3 flex items-center justify-between" style={{
        background: "linear-gradient(135deg, hsla(265, 55%, 25%, 0.95) 0%, hsla(280, 50%, 22%, 0.95) 100%)",
        borderBottom: "1px solid hsla(45, 80%, 55%, 0.15)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 4px 30px hsla(260, 50%, 10%, 0.6)",
      }}>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* Dollar badge */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            animate={{ boxShadow: ["0 0 8px hsla(140,60%,45%,0.3)", "0 0 16px hsla(140,60%,45%,0.5)", "0 0 8px hsla(140,60%,45%,0.3)"] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 shrink-0 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(140 65% 42%), hsl(160 55% 38%))",
            }}
          >
            <span className="text-xs font-black" style={{ color: "hsl(0 0% 100%)" }}>💲</span>
            <span className="font-bold text-xs" style={{ color: "hsl(0 0% 100%)" }}>
              {totalDollar.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </motion.div>
          {/* Star badge */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            animate={{ boxShadow: ["0 0 8px hsla(40,90%,55%,0.3)", "0 0 16px hsla(40,90%,55%,0.5)", "0 0 8px hsla(40,90%,55%,0.3)"] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 shrink-0 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(40 90% 50%), hsl(25 85% 45%))",
            }}
          >
            <span className="text-xs">⭐</span>
            <span className="font-bold text-xs" style={{ color: "hsl(0 0% 10%)" }}>
              Star {totalStar.toLocaleString()}
            </span>
          </motion.div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <motion.div
              whileTap={{ scale: 0.9 }}
              onClick={goToAdmin}
              className="h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer"
              style={{
                background: "linear-gradient(135deg, hsl(0 75% 55%), hsl(25 85% 50%))",
                boxShadow: "0 2px 12px hsla(0, 70%, 50%, 0.4)",
              }}
            >
              <Shield className="h-4 w-4" style={{ color: "hsl(0 0% 100%)" }} />
            </motion.div>
          )}
          <motion.div
            whileTap={{ scale: 0.9 }}
            className="h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(310 65% 55%), hsl(280 55% 50%))",
              boxShadow: "0 2px 12px hsla(310, 60%, 50%, 0.4)",
            }}
          >
            <ShoppingCart className="h-4 w-4" style={{ color: "hsl(0 0% 100%)" }} />
          </motion.div>
          <motion.div
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowProfile(true)}
            className="h-9 w-9 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer"
            style={{
              border: "2px solid hsl(45 85% 60%)",
              background: "linear-gradient(135deg, hsl(45 75% 55%), hsl(30 65% 45%))",
              boxShadow: "0 2px 12px hsla(45, 80%, 55%, 0.4)",
            }}
          >
            <User className="h-4 w-4" style={{ color: "hsl(0 0% 10%)" }} />
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
                  background: "linear-gradient(135deg, hsla(0, 80%, 55%, 0.25), hsla(45, 80%, 50%, 0.15), hsla(280, 60%, 50%, 0.15))",
                  border: "1px solid hsla(45, 70%, 55%, 0.2)",
                  backdropFilter: "blur(10px)",
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

              {/* Wheel Category */}
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
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
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

              {/* Colorful Divider */}
              <div className="h-[2px] rounded-full" style={{
                background: "linear-gradient(90deg, transparent, hsl(280 60% 55%), hsl(45 80% 55%), hsl(0 70% 55%), transparent)",
              }} />

              {/* Crash Category */}
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
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
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
                </div>
              </section>

              {/* Colorful Divider */}
              <div className="h-[2px] rounded-full" style={{
                background: "linear-gradient(90deg, transparent, hsl(280 60% 55%), hsl(45 80% 55%), hsl(0 70% 55%), transparent)",
              }} />
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
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
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
                </div>
              </section>

            </div>
          </motion.div>
        ) : (
          <motion.div key={`tab-${activeTab}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="relative z-10">
            {renderTabContent()}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

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
