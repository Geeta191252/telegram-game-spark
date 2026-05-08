import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Star, DollarSign, RefreshCw, User, CreditCard, Plus, Minus, X, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { getTelegramUser } from "@/lib/telegram";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://broken-bria-chetan1-ea890b93.koyeb.app/api";
const OWNER_ID = 6965488457;

interface AdminStats {
  totalStarsEarned: number;
  starDepositCount: number;
  totalDollarsEarned: number;
  dollarDepositCount: number;
  totalUsers: number;
  recentTransactions: Array<{
    telegramId: number;
    type: string;
    currency: string;
    amount: number;
    createdAt: string;
  }>;
}

interface UserData {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  dollarBalance: number;
  starBalance: number;
  dollarWinning: number;
  starWinning: number;
  lastActive?: string;
  createdAt: string;
}

interface WithdrawalRequest {
  _id: string;
  telegramId: number;
  currency: string;
  amount: number;
  status: string;
  createdAt: string;
  description?: string;
  cryptoAddress?: string;
  withdrawalNetwork?: string;
}

type Tab = "stats" | "users" | "withdrawals";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("stats");

  // Fund adjustment dialog state
  const [adjustUser, setAdjustUser] = useState<UserData | null>(null);
  const [adjustCurrency, setAdjustCurrency] = useState<"star" | "dollar">("star");
  const [adjustType, setAdjustType] = useState<"deposit" | "winning">("deposit");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustAction, setAdjustAction] = useState<"add" | "remove">("add");
  const [adjusting, setAdjusting] = useState(false);
  const [processingWithdrawal, setProcessingWithdrawal] = useState<string | null>(null);

  // Aviator profit %
  const [aviatorProfit, setAviatorProfit] = useState<number>(50);
  const [aviatorProfitInput, setAviatorProfitInput] = useState<string>("50");
  const [savingProfit, setSavingProfit] = useState(false);

  const fetchAviatorProfit = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/admin/aviator/profit?ownerId=${OWNER_ID}`);
      if (r.ok) {
        const d = await r.json();
        setAviatorProfit(d.percent);
        setAviatorProfitInput(String(d.percent));
      }
    } catch (e) { /* ignore */ }
  };

  const saveAviatorProfit = async () => {
    const num = Number(aviatorProfitInput);
    if (isNaN(num) || num < 0 || num > 95) {
      toast({ title: "Invalid value", description: "Enter a number between 0 and 95" });
      return;
    }
    setSavingProfit(true);
    try {
      const r = await fetch(`${API_BASE_URL}/admin/aviator/profit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: String(OWNER_ID), percent: num }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        setAviatorProfit(d.percent);
        toast({ title: "Updated", description: `Aviator profit set to ${d.percent}%` });
      } else {
        toast({ title: "Failed", description: d.error || "Could not update" });
      }
    } catch {
      toast({ title: "Network error", description: "Please retry" });
    }
    setSavingProfit(false);
  };

  // Aviator manual crash queue (per currency)
  const [manualCurrency, setManualCurrency] = useState<"dollar" | "star">("dollar");
  const [manualQueue, setManualQueue] = useState<number[]>([]);
  const [manualActive, setManualActive] = useState(false);
  const [manualInput, setManualInput] = useState<string>("");

  const fetchManualQueue = async (curr: "dollar" | "star" = manualCurrency) => {
    try {
      const r = await fetch(`${API_BASE_URL}/admin/aviator/manual?ownerId=${OWNER_ID}&currency=${curr}`);
      if (r.ok) {
        const d = await r.json();
        setManualQueue(d.queue || []);
        setManualActive(!!d.active);
      }
    } catch { /* ignore */ }
  };

  const addManualValue = async (value: number) => {
    if (!value || value < 1) {
      toast({ title: "Invalid", description: "Value must be ≥ 1.00x" });
      return;
    }
    try {
      const r = await fetch(`${API_BASE_URL}/admin/aviator/manual/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: String(OWNER_ID), currency: manualCurrency, value }),
      });
      const d = await r.json();
      if (r.ok) {
        setManualQueue(d.queue);
        setManualInput("");
      } else {
        toast({ title: "Failed", description: d.error || "Could not add" });
      }
    } catch { toast({ title: "Network error", description: "Please retry" }); }
  };

  const removeManualAt = async (index: number) => {
    try {
      const r = await fetch(`${API_BASE_URL}/admin/aviator/manual/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: String(OWNER_ID), currency: manualCurrency, index }),
      });
      const d = await r.json();
      if (r.ok) setManualQueue(d.queue);
    } catch { /* ignore */ }
  };

  const clearManualQueue = async () => {
    try {
      await fetch(`${API_BASE_URL}/admin/aviator/manual/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: String(OWNER_ID), currency: manualCurrency }),
      });
      setManualQueue([]);
    } catch { /* ignore */ }
  };

  const user = getTelegramUser();
  const isOwner = user?.id === OWNER_ID;

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/stats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerId: String(OWNER_ID) }),
        }),
        fetch(`${API_BASE_URL}/admin/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerId: String(OWNER_ID) }),
        }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
        setWithdrawals(data.withdrawals || []);
      }
    } catch (e) {
      console.error("Failed to fetch admin data", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOwner) { fetchAll(); fetchAviatorProfit(); fetchManualQueue("dollar"); }
  }, []);

  const handleAdjust = async () => {
    if (!adjustUser || !adjustAmount || adjusting) return;
    const num = parseFloat(adjustAmount);
    if (isNaN(num) || num <= 0) return;

    setAdjusting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/adjust-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: String(OWNER_ID),
          targetUserId: adjustUser.telegramId,
          currency: adjustCurrency,
          balanceType: adjustType,
          amount: adjustAction === "add" ? num : -num,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Update local user list
        setUsers(prev => prev.map(u =>
          u.telegramId === adjustUser.telegramId
            ? { ...u, dollarBalance: data.dollarBalance, starBalance: data.starBalance, dollarWinning: data.dollarWinning, starWinning: data.starWinning }
            : u
        ));
        setAdjustUser(null);
        setAdjustAmount("");
      } else {
        alert(data.error || "Failed");
      }
    } catch (e) {
      alert("Network error");
    }
    setAdjusting(false);
  };

  const handleWithdrawalAction = async (txId: string, action: "approve" | "reject") => {
    setProcessingWithdrawal(txId);
    try {
      const endpoint = action === "approve" ? "approve-withdrawal" : "reject-withdrawal";
      const res = await fetch(`${API_BASE_URL}/admin/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: String(OWNER_ID),
          transactionId: txId,
          reason: action === "reject" ? "Admin rejected" : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWithdrawals(prev => prev.filter(w => w._id !== txId));
        alert(data.message);
      } else {
        alert(data.error || "Failed");
      }
    } catch (e) {
      alert("Network error");
    }
    setProcessingWithdrawal(null);
  };

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(260 60% 15%)" }}>
        <p style={{ color: "hsl(0 70% 60%)" }} className="text-lg font-bold">⛔ Access Denied</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "stats", label: "Stats", icon: <Star className="h-4 w-4" /> },
    { key: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { key: "withdrawals", label: "Withdrawals", icon: <CreditCard className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen pb-8" style={{
      background: "linear-gradient(180deg, hsl(260 60% 20%) 0%, hsl(280 50% 15%) 100%)",
    }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-md px-4 py-3 flex items-center gap-3" style={{
        background: "hsla(260, 50%, 20%, 0.9)",
        borderBottom: "1px solid hsla(45, 80%, 50%, 0.3)",
      }}>
        <button onClick={() => navigate("/")} className="p-1">
          <ArrowLeft className="h-5 w-5" style={{ color: "hsl(45 80% 65%)" }} />
        </button>
        <h1 className="font-bold text-lg" style={{ color: "hsl(45 90% 70%)" }}>👑 Admin Panel</h1>
        <button onClick={fetchAll} className="ml-auto p-2 rounded-lg" style={{ background: "hsla(45, 80%, 50%, 0.15)" }}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} style={{ color: "hsl(45 80% 65%)" }} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mt-3">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: activeTab === tab.key ? "hsla(45, 80%, 50%, 0.25)" : "hsla(260, 40%, 30%, 0.4)",
              color: activeTab === tab.key ? "hsl(45 90% 70%)" : "hsl(0 0% 55%)",
              border: activeTab === tab.key ? "1px solid hsla(45, 80%, 50%, 0.4)" : "1px solid transparent",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin" style={{ color: "hsl(45 80% 65%)" }} />
        </div>
      ) : (
        <div className="px-4 mt-4">
          {/* Stats Tab */}
          {activeTab === "stats" && stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-4" style={{
                  background: "linear-gradient(135deg, hsla(200, 70%, 50%, 0.2), hsla(220, 60%, 40%, 0.2))",
                  border: "1px solid hsla(200, 70%, 50%, 0.3)",
                }}>
                  <Star className="h-5 w-5 mb-2" style={{ color: "hsl(45 90% 60%)" }} />
                  <p className="text-2xl font-bold" style={{ color: "hsl(0 0% 95%)" }}>{stats.totalStarsEarned}</p>
                  <p className="text-xs" style={{ color: "hsl(0 0% 60%)" }}>Total Stars Earned</p>
                  <p className="text-xs mt-1" style={{ color: "hsl(200 70% 60%)" }}>{stats.starDepositCount} deposits</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl p-4" style={{
                  background: "linear-gradient(135deg, hsla(120, 60%, 40%, 0.2), hsla(140, 50%, 35%, 0.2))",
                  border: "1px solid hsla(120, 60%, 40%, 0.3)",
                }}>
                  <DollarSign className="h-5 w-5 mb-2" style={{ color: "hsl(120 60% 55%)" }} />
                  <p className="text-2xl font-bold" style={{ color: "hsl(0 0% 95%)" }}>${stats.totalDollarsEarned.toFixed(2)}</p>
                  <p className="text-xs" style={{ color: "hsl(0 0% 60%)" }}>Total Dollars Earned</p>
                  <p className="text-xs mt-1" style={{ color: "hsl(120 60% 55%)" }}>{stats.dollarDepositCount} deposits</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl p-4" style={{
                  background: "linear-gradient(135deg, hsla(280, 60%, 50%, 0.2), hsla(300, 50%, 40%, 0.2))",
                  border: "1px solid hsla(280, 60%, 50%, 0.3)",
                }}>
                  <Users className="h-5 w-5 mb-2" style={{ color: "hsl(280 60% 65%)" }} />
                  <p className="text-2xl font-bold" style={{ color: "hsl(0 0% 95%)" }}>{stats.totalUsers}</p>
                  <p className="text-xs" style={{ color: "hsl(0 0% 60%)" }}>Total Users</p>
                </motion.div>
              </div>

              {/* Aviator profit control */}
              <div className="rounded-2xl p-4" style={{
                background: "linear-gradient(135deg, hsla(350, 80%, 45%, 0.18), hsla(15, 80%, 45%, 0.18))",
                border: "1px solid hsla(350, 80%, 50%, 0.35)",
              }}>
                <h2 className="font-bold text-sm mb-2" style={{ color: "hsl(45 90% 70%)" }}>✈️ Aviator House Profit</h2>
                <p className="text-xs mb-3" style={{ color: "hsl(0 0% 70%)" }}>
                  Current: <span className="font-bold" style={{ color: "hsl(350 90% 65%)" }}>{aviatorProfit}%</span> kept by house each round.
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    max={95}
                    value={aviatorProfitInput}
                    onChange={(e) => setAviatorProfitInput(e.target.value)}
                    className="flex-1 rounded-lg px-3 py-2 text-sm font-bold outline-none"
                    style={{ background: "hsla(260, 40%, 15%, 0.8)", color: "hsl(0 0% 95%)", border: "1px solid hsla(45, 60%, 50%, 0.3)" }}
                  />
                  <span className="text-sm font-bold" style={{ color: "hsl(45 90% 70%)" }}>%</span>
                  <button
                    onClick={saveAviatorProfit}
                    disabled={savingProfit}
                    className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                    style={{ background: "hsl(350 80% 50%)", color: "white" }}
                  >
                    {savingProfit ? "Saving…" : "Save"}
                  </button>
                </div>
                <p className="text-[10px] mt-2" style={{ color: "hsl(0 0% 55%)" }}>
                  Example: 50% means if total bets are $100, total cashouts are capped at $50.
                </p>
              </div>

              {/* Aviator Manual Crash Control */}
              <div className="rounded-2xl p-4" style={{
                background: "linear-gradient(135deg, hsla(280, 80%, 35%, 0.22), hsla(220, 80%, 35%, 0.22))",
                border: "1px solid hsla(280, 80%, 55%, 0.4)",
              }}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-sm" style={{ color: "hsl(45 90% 70%)" }}>🎯 Aviator Manual Crash Control</h2>
                  {manualActive && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "hsl(140 70% 40%)", color: "white" }}>LIVE</span>
                  )}
                </div>
                <p className="text-xs mb-3" style={{ color: "hsl(0 0% 70%)" }}>
                  Queue exact crash multipliers. Each round consumes one — overrides the auto profit cap.
                </p>

                {/* Currency tabs */}
                <div className="flex gap-2 mb-3">
                  {(["dollar", "star"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => { setManualCurrency(c); fetchManualQueue(c); }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold transition"
                      style={{
                        background: manualCurrency === c ? "hsl(280 70% 50%)" : "hsla(260, 40%, 18%, 0.8)",
                        color: manualCurrency === c ? "white" : "hsl(0 0% 70%)",
                        border: `1px solid ${manualCurrency === c ? "hsl(280 70% 60%)" : "hsla(280, 50%, 40%, 0.3)"}`,
                      }}
                    >
                      {c === "dollar" ? "$ Dollar" : "⭐ Star"}
                    </button>
                  ))}
                </div>

                {/* Quick add buttons */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[1, 1.5, 2, 3, 4, 5, 10].map((v) => (
                    <button
                      key={v}
                      onClick={() => addManualValue(v)}
                      className="px-2.5 py-1 rounded-md text-xs font-bold"
                      style={{ background: "hsl(350 80% 50%)", color: "white" }}
                    >
                      {v}x
                    </button>
                  ))}
                </div>

                {/* Custom input */}
                <div className="flex gap-2 items-center mb-3">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="Custom (e.g. 1.75)"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="flex-1 rounded-lg px-3 py-2 text-sm font-bold outline-none"
                    style={{ background: "hsla(260, 40%, 15%, 0.8)", color: "hsl(0 0% 95%)", border: "1px solid hsla(280, 60%, 50%, 0.3)" }}
                  />
                  <button
                    onClick={() => { const n = Number(manualInput); if (!isNaN(n)) addManualValue(n); }}
                    className="px-4 py-2 rounded-lg text-xs font-bold"
                    style={{ background: "hsl(140 70% 40%)", color: "white" }}
                  >
                    + Add
                  </button>
                </div>

                {/* Queue list */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold" style={{ color: "hsl(0 0% 70%)" }}>
                    Queue ({manualQueue.length})
                  </span>
                  {manualQueue.length > 0 && (
                    <button
                      onClick={clearManualQueue}
                      className="text-[10px] font-bold px-2 py-0.5 rounded"
                      style={{ background: "hsla(0, 70%, 40%, 0.3)", color: "hsl(0 90% 75%)" }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="rounded-lg p-2 min-h-[44px]" style={{ background: "hsla(260, 40%, 12%, 0.6)", border: "1px solid hsla(280, 50%, 40%, 0.2)" }}>
                  {manualQueue.length === 0 ? (
                    <p className="text-xs text-center py-2" style={{ color: "hsl(0 0% 50%)" }}>
                      Empty — auto profit% logic will run.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {manualQueue.map((v, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold"
                          style={{ background: i === 0 ? "hsl(45 90% 50%)" : "hsla(280, 60%, 50%, 0.8)", color: i === 0 ? "hsl(260 70% 15%)" : "white" }}
                        >
                          #{i + 1}: {v}x
                          <button onClick={() => removeManualAt(i)} className="ml-0.5 opacity-80 hover:opacity-100" aria-label="Remove">✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[10px] mt-2" style={{ color: "hsl(0 0% 55%)" }}>
                  #1 (yellow) is next round's crash. Lower values = more user losses, higher profit.
                </p>
                <button
                  onClick={() => fetchManualQueue()}
                  className="w-full mt-2 py-1.5 rounded-md text-[11px] font-bold"
                  style={{ background: "hsla(260, 40%, 20%, 0.8)", color: "hsl(0 0% 80%)" }}
                >
                  ↻ Refresh
                </button>
              </div>

              <div>
                <h2 className="font-bold text-sm mb-3" style={{ color: "hsl(45 90% 70%)" }}>📋 Recent Deposits</h2>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {stats.recentTransactions.map((tx, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      className="rounded-xl p-3 flex items-center justify-between"
                      style={{ background: "hsla(260, 40%, 25%, 0.6)", border: "1px solid hsla(260, 40%, 40%, 0.2)" }}>
                      <div>
                        <p className="text-xs font-mono" style={{ color: "hsl(0 0% 60%)" }}>ID: {tx.telegramId}</p>
                        <p className="text-[10px]" style={{ color: "hsl(0 0% 45%)" }}>{new Date(tx.createdAt).toLocaleString()}</p>
                      </div>
                      <p className="font-bold text-sm" style={{ color: tx.currency === "star" ? "hsl(45 90% 60%)" : "hsl(120 60% 55%)" }}>
                        {tx.currency === "star" ? `⭐ ${tx.amount}` : `$${tx.amount}`}
                      </p>
                    </motion.div>
                  ))}
                  {stats.recentTransactions.length === 0 && (
                    <p className="text-center text-sm py-4" style={{ color: "hsl(0 0% 50%)" }}>No deposits yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <div className="space-y-3">
              {/* Active / Offline summary */}
              {(() => {
                const now = Date.now();
                const FIVE_MIN = 5 * 60 * 1000;
                const activeUsers = users.filter(u => u.lastActive && (now - new Date(u.lastActive).getTime()) < FIVE_MIN);
                const offlineUsers = users.filter(u => !u.lastActive || (now - new Date(u.lastActive).getTime()) >= FIVE_MIN);
                return (
                  <>
                    {/* Summary bar */}
                    <div className="flex gap-3 mb-1">
                      <div className="flex-1 rounded-xl p-3 flex items-center gap-2" style={{
                        background: "linear-gradient(135deg, hsla(120, 70%, 40%, 0.25), hsla(140, 60%, 35%, 0.15))",
                        border: "1px solid hsla(120, 70%, 45%, 0.4)",
                      }}>
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "hsl(120 70% 50%)", boxShadow: "0 0 8px hsl(120 70% 50%)" }} />
                        <div>
                          <p className="text-lg font-bold" style={{ color: "hsl(120 70% 65%)" }}>{activeUsers.length}</p>
                          <p className="text-[10px] font-bold" style={{ color: "hsl(120 50% 55%)" }}>Active Now</p>
                        </div>
                      </div>
                      <div className="flex-1 rounded-xl p-3 flex items-center gap-2" style={{
                        background: "linear-gradient(135deg, hsla(0, 0%, 50%, 0.15), hsla(0, 0%, 40%, 0.1))",
                        border: "1px solid hsla(0, 0%, 50%, 0.3)",
                      }}>
                        <div className="w-3 h-3 rounded-full" style={{ background: "hsl(0 0% 45%)" }} />
                        <div>
                          <p className="text-lg font-bold" style={{ color: "hsl(0 0% 65%)" }}>{offlineUsers.length}</p>
                          <p className="text-[10px] font-bold" style={{ color: "hsl(0 0% 50%)" }}>Offline</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs" style={{ color: "hsl(0 0% 50%)" }}>{users.length} total users</p>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {users.map((u, i) => {
                        const isActive = u.lastActive && (now - new Date(u.lastActive).getTime()) < FIVE_MIN;
                        const lastSeenText = u.lastActive
                          ? (() => {
                              const diff = now - new Date(u.lastActive).getTime();
                              if (diff < 60000) return "Just now";
                              if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                              if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                              return `${Math.floor(diff / 86400000)}d ago`;
                            })()
                          : "Never";
                        return (
                          <motion.div key={u.telegramId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                            className="rounded-xl p-3" style={{
                              background: "hsla(260, 40%, 25%, 0.6)",
                              border: isActive
                                ? "1px solid hsla(120, 70%, 45%, 0.4)"
                                : "1px solid hsla(260, 40%, 40%, 0.2)",
                            }}>
                            <div className="flex items-center gap-2 mb-2">
                              {/* Online/Offline dot */}
                              <div className="relative">
                                <User className="h-4 w-4" style={{ color: "hsl(45 80% 65%)" }} />
                                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                                  style={{
                                    background: isActive ? "hsl(120 70% 50%)" : "hsl(0 0% 45%)",
                                    borderColor: "hsl(260 40% 25%)",
                                    boxShadow: isActive ? "0 0 6px hsl(120 70% 50%)" : "none",
                                  }}
                                />
                              </div>
                              <span className="text-xs font-bold" style={{ color: "hsl(0 0% 90%)" }}>
                                {u.firstName || u.username || "Unknown"}
                                {u.lastName ? ` ${u.lastName}` : ""}
                              </span>
                              {u.username && (
                                <span className="text-[10px]" style={{ color: "hsl(200 70% 60%)" }}>@{u.username}</span>
                              )}
                              {/* Status badge */}
                              <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full font-bold" style={{
                                background: isActive ? "hsla(120, 70%, 45%, 0.2)" : "hsla(0, 0%, 50%, 0.15)",
                                color: isActive ? "hsl(120 70% 60%)" : "hsl(0 0% 55%)",
                              }}>
                                {isActive ? "🟢 Online" : `⚫ ${lastSeenText}`}
                              </span>
                            </div>
                            <p className="text-[10px] font-mono mb-2" style={{ color: "hsl(0 0% 50%)" }}>ID: {u.telegramId}</p>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div className="rounded-lg p-2" style={{ background: "hsla(45, 80%, 50%, 0.1)" }}>
                                <p className="text-[10px]" style={{ color: "hsl(0 0% 50%)" }}>⭐ Star Wallet</p>
                                <p className="text-sm font-bold" style={{ color: "hsl(45 90% 60%)" }}>
                                  {(u.starBalance || 0) + (u.starWinning || 0)}
                                </p>
                              </div>
                              <div className="rounded-lg p-2" style={{ background: "hsla(120, 60%, 40%, 0.1)" }}>
                                <p className="text-[10px]" style={{ color: "hsl(0 0% 50%)" }}>$ Dollar Wallet</p>
                                <p className="text-sm font-bold" style={{ color: "hsl(120 60% 55%)" }}>
                                  ${((u.dollarBalance || 0) + (u.dollarWinning || 0)).toFixed(2)}
                                </p>
                              </div>
                            </div>
                            {/* Fund Adjust Button */}
                            <button
                              onClick={() => { setAdjustUser(u); setAdjustAmount(""); setAdjustAction("add"); }}
                              className="w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                              style={{
                                background: "linear-gradient(135deg, hsla(45, 80%, 50%, 0.25), hsla(30, 80%, 50%, 0.25))",
                                border: "1px solid hsla(45, 80%, 50%, 0.4)",
                                color: "hsl(45 90% 70%)",
                              }}
                            >
                              <DollarSign className="h-3.5 w-3.5" /> Adjust Fund
                            </button>
                          </motion.div>
                        );
                      })}
                      {users.length === 0 && (
                        <p className="text-center text-sm py-8" style={{ color: "hsl(0 0% 50%)" }}>No users yet</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Withdrawals Tab */}
          {activeTab === "withdrawals" && (
            <div className="space-y-2">
              <p className="text-xs mb-2" style={{ color: "hsl(0 0% 50%)" }}>{withdrawals.length} pending requests</p>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {withdrawals.map((w, i) => (
                  <motion.div key={w._id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className="rounded-xl p-3 space-y-2" style={{ background: "hsla(260, 40%, 25%, 0.6)", border: "1px solid hsla(0, 70%, 45%, 0.3)" }}>
                    <div className="flex items-center justify-between">
                      <div>
                        {(() => {
                          const user = users.find(u => u.telegramId === w.telegramId);
                          return user ? (
                            <p className="text-xs font-bold cursor-pointer mb-0.5" style={{ color: "hsl(210 90% 60%)" }}>
                              👤 {user.firstName}{user.lastName ? ` ${user.lastName}` : ""}
                            </p>
                          ) : null;
                        })()}
                        <span className="text-xs font-mono" style={{ color: "hsl(0 0% 60%)" }}>ID: {w.telegramId}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{
                        background: "hsla(45, 80%, 50%, 0.2)",
                        color: "hsl(45 80% 65%)",
                      }}>{w.status}</span>
                    </div>
                    <p className="font-bold text-sm" style={{
                      color: w.currency === "star" ? "hsl(45 90% 60%)" : "hsl(120 60% 55%)",
                    }}>
                      {w.currency === "star" ? `⭐ ${Math.abs(w.amount)}` : `$${Math.abs(w.amount).toFixed(2)}`}
                    </p>
                    {/* Crypto Address & Network */}
                    <div className="rounded-lg p-2 space-y-1" style={{ background: "hsla(200, 60%, 50%, 0.1)", border: "1px solid hsla(200, 60%, 50%, 0.2)" }}>
                      <p className="text-[10px] font-bold" style={{ color: "hsl(200 70% 60%)" }}>
                        🔗 Network: <span style={{ color: "hsl(45 80% 65%)" }}>{w.withdrawalNetwork || "Not specified"}</span>
                      </p>
                      <p className="text-[10px] font-bold" style={{ color: "hsl(200 70% 60%)" }}>📍 Crypto Address:</p>
                      <div className="flex items-center gap-1">
                        <p className="text-[11px] font-mono break-all flex-1" style={{ color: "hsl(0 0% 80%)" }}>{w.cryptoAddress || "N/A"}</p>
                        {w.cryptoAddress && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(w.cryptoAddress || "");
                              toast({ title: "✅ Copied!", description: "Address copied to clipboard" });
                            }}
                            className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
                            title="Copy address"
                          >
                            <Copy className="w-3.5 h-3.5" style={{ color: "hsl(45 80% 65%)" }} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px]" style={{ color: "hsl(0 0% 45%)" }}>
                      {new Date(w.createdAt).toLocaleString()}
                    </p>
                    {w.description && <p className="text-[10px]" style={{ color: "hsl(0 0% 40%)" }}>{w.description}</p>}
                    {/* Approve / Reject Buttons */}
                    {w.status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleWithdrawalAction(w._id, "approve")}
                          disabled={processingWithdrawal === w._id}
                          className="flex-1 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                          style={{
                            background: "linear-gradient(135deg, hsl(120 60% 35%), hsl(140 50% 30%))",
                            color: "hsl(0 0% 95%)",
                          }}
                        >
                          {processingWithdrawal === w._id ? "..." : "✅ Approve"}
                        </button>
                        <button
                          onClick={() => handleWithdrawalAction(w._id, "reject")}
                          disabled={processingWithdrawal === w._id}
                          className="flex-1 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                          style={{
                            background: "linear-gradient(135deg, hsl(0 70% 40%), hsl(15 60% 35%))",
                            color: "hsl(0 0% 95%)",
                          }}
                        >
                          {processingWithdrawal === w._id ? "..." : "❌ Reject"}
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
                {withdrawals.length === 0 && (
                  <p className="text-center text-sm py-8" style={{ color: "hsl(0 0% 50%)" }}>No withdrawal requests</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fund Adjustment Modal */}
      {adjustUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "hsla(0,0%,0%,0.7)" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-2xl p-5"
            style={{
              background: "linear-gradient(180deg, hsl(260 50% 22%) 0%, hsl(270 45% 18%) 100%)",
              border: "1px solid hsla(45, 80%, 50%, 0.3)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm" style={{ color: "hsl(45 90% 70%)" }}>
                💰 Adjust Fund — {adjustUser.firstName || adjustUser.username || adjustUser.telegramId}
              </h3>
              <button onClick={() => setAdjustUser(null)} className="p-1">
                <X className="h-4 w-4" style={{ color: "hsl(0 0% 60%)" }} />
              </button>
            </div>

            {/* Add / Remove toggle */}
            <div className="flex gap-2 mb-3">
              {(["add", "remove"] as const).map(a => (
                <button
                  key={a}
                  onClick={() => setAdjustAction(a)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                  style={{
                    background: adjustAction === a
                      ? a === "add" ? "hsla(120, 60%, 40%, 0.3)" : "hsla(0, 70%, 45%, 0.3)"
                      : "hsla(260, 40%, 30%, 0.4)",
                    border: adjustAction === a
                      ? `1px solid ${a === "add" ? "hsla(120, 60%, 50%, 0.5)" : "hsla(0, 70%, 50%, 0.5)"}`
                      : "1px solid transparent",
                    color: adjustAction === a
                      ? a === "add" ? "hsl(120 60% 65%)" : "hsl(0 70% 65%)"
                      : "hsl(0 0% 55%)",
                  }}
                >
                  {a === "add" ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  {a === "add" ? "Add" : "Remove"}
                </button>
              ))}
            </div>

            {/* Currency toggle */}
            <div className="flex gap-2 mb-3">
              {(["star", "dollar"] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setAdjustCurrency(c)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: adjustCurrency === c ? "hsla(45, 80%, 50%, 0.25)" : "hsla(260, 40%, 30%, 0.4)",
                    border: adjustCurrency === c ? "1px solid hsla(45, 80%, 50%, 0.4)" : "1px solid transparent",
                    color: adjustCurrency === c ? "hsl(45 90% 70%)" : "hsl(0 0% 55%)",
                  }}
                >
                  {c === "star" ? "⭐ Star" : "$ Dollar"}
                </button>
              ))}
            </div>

            {/* Balance type toggle */}
            <div className="flex gap-2 mb-3">
              {(["deposit", "winning"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setAdjustType(t)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: adjustType === t ? "hsla(280, 60%, 50%, 0.25)" : "hsla(260, 40%, 30%, 0.4)",
                    border: adjustType === t ? "1px solid hsla(280, 60%, 50%, 0.4)" : "1px solid transparent",
                    color: adjustType === t ? "hsl(280 60% 75%)" : "hsl(0 0% 55%)",
                  }}
                >
                  {t === "deposit" ? "Deposit" : "Winning"}
                </button>
              ))}
            </div>

            {/* Amount input */}
            <input
              type="number"
              value={adjustAmount}
              onChange={e => setAdjustAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full rounded-xl px-4 py-3 text-sm font-bold mb-4 outline-none"
              style={{
                background: "hsla(260, 40%, 18%, 0.8)",
                border: "1px solid hsla(260, 40%, 40%, 0.3)",
                color: "hsl(0 0% 90%)",
              }}
            />

            {/* Confirm button */}
            <button
              onClick={handleAdjust}
              disabled={adjusting || !adjustAmount || parseFloat(adjustAmount) <= 0}
              className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{
                background: adjustAction === "add"
                  ? "linear-gradient(135deg, hsl(120 60% 40%), hsl(140 50% 35%))"
                  : "linear-gradient(135deg, hsl(0 70% 45%), hsl(15 60% 40%))",
                color: "hsl(0 0% 95%)",
              }}
            >
              {adjusting ? "Processing..." : `${adjustAction === "add" ? "➕ Add" : "➖ Remove"} ${adjustAmount || "0"} ${adjustCurrency === "star" ? "⭐" : "$"}`}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
