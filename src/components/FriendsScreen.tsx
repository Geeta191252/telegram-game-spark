import { motion } from "framer-motion";
import { Copy, Send, Check } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "@/hooks/use-toast";
import { getTelegramUser, getTelegram } from "@/lib/telegram";
import { useBalance } from "@/hooks/useBalance";

const inviteTasks = [
  { title: "Invite 1st friend", reward: "5 ⭐", icon: "⭐", target: 1 },
  { title: "Invite 2nd friend", reward: "5 ⭐", icon: "⭐", target: 2 },
  { title: "Invite 3rd friend", reward: "5 ⭐", icon: "⭐", target: 3 },
];

const FriendsScreen = () => {
  const user = getTelegramUser();
  const userId = user?.id || "unknown";
  const referralLink = `https://t.me/RoyalKingGameBot?start=ref_${userId}`;
  const { data } = useBalance();
  const referralCount = data?.referralCount || 0;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
  };

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="font-extrabold text-2xl text-foreground">Build your team!</h2>
        <p className="text-muted-foreground text-sm">Share the fun and get rewards.</p>
      </div>

      {/* Referral Link Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/60 border border-border/50 rounded-2xl p-4 space-y-3"
      >
        <p className="text-xs text-muted-foreground">Your referral link</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted/30 border border-border/40 rounded-xl px-4 py-2.5 font-mono text-sm text-foreground truncate">
            {referralLink}
          </div>
          <Button size="icon" variant="ghost" onClick={copyLink} className="rounded-xl h-10 w-10 shrink-0">
            <Copy className="h-5 w-5" />
          </Button>
        </div>
        <Button
          className="w-full rounded-2xl h-12 text-base font-extrabold uppercase tracking-wide bg-yellow-400 hover:bg-yellow-500 text-black border-2 border-yellow-500"
          onClick={() => {
            const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("🎮 Royal King Game khelo aur stars kamao! Join karo mere referral link se!")}`;
            const tg = getTelegram();
            if (tg?.openTelegramLink) {
              tg.openTelegramLink(shareUrl);
            } else {
              window.open(shareUrl, "_blank");
            }
          }}
        >
          <Send className="h-5 w-5 mr-2" /> Invite Friends
        </Button>
      </motion.div>

      {/* Invite Tasks */}
      <div className="space-y-3">
        {inviteTasks.map((task, i) => {
          const completed = referralCount >= task.target;
          return (
            <motion.div
              key={task.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-center gap-3 p-3 rounded-2xl border ${completed ? "bg-green-900/20 border-green-500/40" : "bg-card/60 border-border/50"}`}
            >
              <div className={`h-14 w-14 rounded-xl flex items-center justify-center shrink-0 text-3xl ${completed ? "bg-green-500/20" : "bg-muted/50"}`}>
                {completed ? <Check className="h-8 w-8 text-green-400" /> : "🧑‍🤝‍🧑"}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-foreground">{task.title}</h4>
                {completed && <p className="text-xs text-green-400">✅ Completed</p>}
              </div>
              <span className="text-xl font-bold text-foreground shrink-0">{task.reward}</span>
              <span className="text-lg shrink-0">{task.icon}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Total Referral Count */}
      <div className="bg-card/60 border border-border/50 rounded-2xl p-4 text-center">
        <p className="text-muted-foreground text-xs mb-1">Total Referrals</p>
        <p className="text-3xl font-extrabold text-foreground">{referralCount}</p>
      </div>

      <div className="text-xs text-muted-foreground text-center px-2 space-y-1">
        <p>📌 Har refer par aapko 5 ⭐ milega — jab aapka friend pehli baar deposit karega.</p>
        <p>📌 You earn 5 ⭐ per referral — unlocked once your friend makes their first deposit.</p>
        <p>⭐ Refer se milne wale Stars aapke ⭐ Star wallet mein add honge.</p>
        <p>⭐ Stars earned from referrals will be added to your ⭐ Star wallet.</p>
      </div>
    </div>
  );
};

export default FriendsScreen;
