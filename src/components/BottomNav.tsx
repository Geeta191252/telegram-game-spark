import { motion } from "framer-motion";
import navGames from "@/assets/nav-games.png";
import navMarket from "@/assets/nav-market.png";
import navEarn from "@/assets/nav-earn.png";
import navFriends from "@/assets/nav-friends.png";
import navWallet from "@/assets/nav-wallet.png";

const tabs = [
  { icon: navGames, label: "Games", activeColor: "hsl(0 75% 60%)" },
  { icon: navMarket, label: "Market", activeColor: "hsl(25 90% 55%)" },
  { icon: navEarn, label: "Earn", activeColor: "hsl(45 90% 55%)" },
  { icon: navFriends, label: "Invite", activeColor: "hsl(280 65% 60%)" },
  { icon: navWallet, label: "Wallet", activeColor: "hsl(140 60% 50%)" },
];

interface BottomNavProps {
  activeTab: number;
  onTabChange: (index: number) => void;
}

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40" style={{
      background: "linear-gradient(180deg, hsl(265, 55%, 16%), hsl(270, 50%, 11%))",
      borderTop: "1px solid hsla(280, 50%, 40%, 0.2)",
      boxShadow: "0 -4px 20px hsla(260, 50%, 10%, 0.5)",
    }}>
      <div className="mx-auto flex max-w-md items-center justify-around py-1">
        {tabs.map((tab, i) => {
          const isActive = activeTab === i;
          const handleClick = useButtonClick(() => onTabChange(i));
          return (
            <motion.button
              key={tab.label}
              onClick={handleClick}
              whileTap={{ scale: 0.85 }}
              className="flex flex-col items-center gap-0.5 px-4 py-1 relative"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabGlow"
                  className="absolute -top-1 w-10 h-1 rounded-full"
                  style={{
                    background: tab.activeColor,
                    boxShadow: `0 0 12px ${tab.activeColor}`,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
              <motion.img
                src={tab.icon}
                alt={tab.label}
                className="h-10 w-10 object-contain"
                animate={{
                  scale: isActive ? 1.15 : 0.9,
                  opacity: isActive ? 1 : 0.5,
                  filter: isActive ? `drop-shadow(0 0 6px ${tab.activeColor})` : "none",
                }}
                transition={{ type: "spring", stiffness: 200 }}
              />
              <motion.span
                className="text-[10px] font-bold"
                animate={{ opacity: isActive ? 1 : 0.5 }}
                style={{ color: isActive ? tab.activeColor : "hsl(260 20% 55%)" }}
              >
                {tab.label}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
