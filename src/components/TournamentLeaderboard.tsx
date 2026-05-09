import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Trophy, Crown, Medal, Clock } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://broken-bria-chetan1-ea890b93.koyeb.app/api";

export interface PrizeTier { fromRank: number; toRank: number; amount: number; }
export interface Tournament {
  _id: string;
  title: string;
  imageUrl?: string;
  prizeCurrency: "dollar" | "star";
  tier: number;
  prizePerWinner: number;
  prizeTiers?: PrizeTier[];
  gameFilter?: string;
  startedAt: string;
  endsAt?: string | null;
  active: boolean;
}

interface LeaderboardEntry {
  rank: number;
  telegramId: number;
  gamesPlayed: number;
  firstName: string;
  username: string;
  prize: number;
  currency: "dollar" | "star";
}

interface Props {
  tournament: Tournament;
  onClose: () => void;
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${sec}s`;
  return `${h}h ${m}m ${sec}s`;
}

const TournamentLeaderboard = ({ tournament, onClose }: Props) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/tournaments/${tournament._id}/leaderboard`);
        if (r.ok) {
          const d = await r.json();
          setEntries(d.leaderboard || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [tournament._id]);

  const sym = tournament.prizeCurrency === "dollar" ? "$" : "⭐";
  const remainingMs = tournament.endsAt ? new Date(tournament.endsAt).getTime() - now : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      style={{ background: "hsla(260,50%,8%,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(180deg, hsl(265 55% 22%) 0%, hsl(280 50% 14%) 100%)",
          border: "1.5px solid hsla(45,80%,55%,0.35)",
        }}
      >
        {/* Header */}
        <div className="p-4 flex items-center gap-3" style={{
          background: "linear-gradient(135deg, hsla(280,70%,40%,0.6), hsla(45,80%,45%,0.4))",
          borderBottom: "1px solid hsla(45,80%,55%,0.25)",
        }}>
          <Trophy className="h-6 w-6" style={{ color: "hsl(45 95% 65%)" }} />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base truncate" style={{ color: "hsl(45 95% 75%)" }}>{tournament.title}</h2>
            <p className="text-[11px]" style={{ color: "hsl(0 0% 80%)" }}>
              Top {tournament.tier} • {tournament.prizeTiers && tournament.prizeTiers.length > 0
                ? `1st ${sym}${tournament.prizeTiers[0].amount}`
                : `Prize ${sym}${tournament.prizePerWinner} each`}
            </p>
            {tournament.endsAt && (
              <p className="text-[11px] flex items-center gap-1 mt-0.5 font-bold" style={{ color: remainingMs > 0 ? "hsl(140 70% 65%)" : "hsl(0 70% 65%)" }}>
                <Clock className="h-3 w-3" />
                {formatRemaining(remainingMs)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: "hsla(0,0%,100%,0.1)" }}>
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-3 space-y-1.5">
          {loading ? (
            <p className="text-center py-10 text-sm" style={{ color: "hsl(0 0% 60%)" }}>Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: "hsl(0 0% 60%)" }}>
              Abhi koi player nahi. Game khel ke top {tournament.tier} mein aao!
            </p>
          ) : (
            entries.map((e) => {
              const isTop3 = e.rank <= 3;
              const rankColor = e.rank === 1 ? "hsl(45 95% 60%)" : e.rank === 2 ? "hsl(0 0% 80%)" : e.rank === 3 ? "hsl(25 80% 55%)" : "hsl(280 30% 70%)";
              return (
                <div key={e.telegramId} className="flex items-center gap-3 rounded-xl p-2.5" style={{
                  background: isTop3
                    ? `linear-gradient(90deg, hsla(45,80%,50%,0.18), hsla(280,50%,30%,0.4))`
                    : "hsla(260,40%,25%,0.5)",
                  border: isTop3 ? `1px solid ${rankColor}55` : "1px solid hsla(260,40%,40%,0.2)",
                }}>
                  <div className="w-8 flex justify-center">
                    {e.rank === 1 ? <Crown className="h-5 w-5" style={{ color: rankColor }} /> :
                     e.rank <= 3 ? <Medal className="h-5 w-5" style={{ color: rankColor }} /> :
                     <span className="text-xs font-bold" style={{ color: rankColor }}>#{e.rank}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: "hsl(0 0% 95%)" }}>{e.firstName}</p>
                    <p className="text-[10px]" style={{ color: "hsl(260 30% 70%)" }}>{e.gamesPlayed} games played</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold" style={{ color: "hsl(120 60% 60%)" }}>+{sym}{e.prize}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TournamentLeaderboard;
