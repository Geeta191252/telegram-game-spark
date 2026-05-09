import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { ArrowDownLeft, ArrowUpRight, DollarSign, Star, ArrowRightLeft, Wallet, Unplug, Coins, ExternalLink } from "lucide-react";
import { useTonConnectUI, useTonWallet, useTonAddress } from "@tonconnect/ui-react";
// @ton/core is dynamically imported where needed to avoid Buffer polyfill issues
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { isTelegramMiniApp, initiatePayment, fetchTransactions, fetchWinnings, getTelegram, type CurrencyType, type ActionType } from "@/lib/telegram";
import { useBalanceContext } from "@/contexts/BalanceContext";
import AmountInputDialog from "./AmountInputDialog";

const STAR_TO_DOLLAR_RATE = 100; // 100 ⭐ = $1

// NOWPayments requires network-specific tickers for some coins
const cryptoApiTicker: Record<string, string> = {
  usdt: "usdttrc20", // USDT on TRC20 network
};

// Minimum USD deposits per crypto - these are display hints only, backend validates actual minimums
const cryptoMins: Record<string, number> = {
  btc: 18, ltc: 4, ton: 4, sol: 4, trx: 4, doge: 6,
};

const fallbackTransactions = [
  { type: "win", game: "Greedy King", amount: "+250", currency: "💲", time: "2 min ago" },
  { type: "bet", game: "Greedy King", amount: "-100", currency: "💲", time: "5 min ago" },
  { type: "win", game: "Lucky Slots", amount: "+80", currency: "⭐", time: "1 hr ago" },
  { type: "bonus", game: "Daily Login", amount: "+50", currency: "💲", time: "3 hr ago" },
  { type: "bet", game: "Dice Master", amount: "-200", currency: "⭐", time: "5 hr ago" },
];

type CurrencyOption = "dollar" | "star";

interface CurrencyMenuProps {
  show: boolean;
  onSelect: (currency: CurrencyOption) => void;
  onClose: () => void;
}

const CurrencyMenu = ({ show, onSelect, onClose }: CurrencyMenuProps) => (
  <AnimatePresence>
    {show && (
      <>
        <div className="fixed inset-0 z-40" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="absolute top-full mt-2 left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
        >
          <button
            onClick={() => onSelect("dollar")}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <span className="text-lg">💲</span>
            <span className="font-semibold text-sm text-foreground">Dollar ($)</span>
          </button>
          <div className="h-px bg-border" />
          <button
            onClick={() => onSelect("star")}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <span className="text-lg">⭐</span>
            <span className="font-semibold text-sm text-foreground">Star (⭐)</span>
          </button>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

const WalletScreen = () => {
  const [loading, setLoading] = useState(false);
  const [amountDialog, setAmountDialog] = useState<{
    open: boolean;
    action: ActionType;
    currency: CurrencyType;
  }>({ open: false, action: "deposit", currency: "dollar" });

  // Withdraw dialog state
  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawNetwork, setWithdrawNetwork] = useState("");
  const [withdrawCurrency, setWithdrawCurrency] = useState<CurrencyType>("dollar");
  const [withdrawCrypto, setWithdrawCrypto] = useState("btc");
  const [withdrawing, setWithdrawing] = useState(false);

  const withdrawCryptoOptions = [
    { id: "btc", label: "BTC", network: "Bitcoin" },
    { id: "ltc", label: "LTC", network: "Litecoin" },
    { id: "ton", label: "TON", network: "TON" },
    { id: "sol", label: "SOL", network: "Solana" },
    { id: "trx", label: "TRX", network: "TRC20" },
    { id: "doge", label: "DOGE", network: "Dogecoin" },
  ];

  // Converter state
  const [convertStars, setConvertStars] = useState("");
  const [converting, setConverting] = useState(false);

  // TON Connect
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const tonAddress = useTonAddress(false);

  // TON deposit/withdraw state
  const [tonDepositAmount, setTonDepositAmount] = useState("");
  const [tonWithdrawAmount, setTonWithdrawAmount] = useState("");
  const [tonProcessing, setTonProcessing] = useState(false);
  const [tonPrice, setTonPrice] = useState<number | null>(null);

  // Crypto (NOWPayments) state
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [cryptoCurrency, setCryptoCurrency] = useState("btc");
  const [cryptoProcessing, setCryptoProcessing] = useState(false);
  const [cryptoPayment, setCryptoPayment] = useState<{
    payAddress: string;
    payAmount: number;
    payCurrency: string;
    orderId: string;
  } | null>(null);

  const { dollarBalance, starBalance, dollarWinning, starWinning, refreshBalance } = useBalanceContext();
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  const apiBase = import.meta.env.VITE_API_BASE_URL || "https://broken-bria-chetan1-ea890b93.koyeb.app/api";

  // Auto-poll payment status when cryptoPayment is active
  useEffect(() => {
    if (!cryptoPayment?.orderId) {
      setPaymentStatus(null);
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`${apiBase}/crypto/check-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: cryptoPayment.orderId }),
        });
        const data = await res.json();
        setPaymentStatus(data.status);
        if (data.status === "completed") {
          toast({
            title: "Payment Received! ✅",
            description: `$${data.amount} has been added to your wallet.`,
          });
          refreshBalance();
          setCryptoPayment(null);
        }
      } catch { /* ignore */ }
    };

    poll(); // immediate check
    const interval = setInterval(poll, 10000); // every 10s
    return () => clearInterval(interval);
  }, [cryptoPayment?.orderId]);

  const { data: transactions = fallbackTransactions } = useQuery({
    queryKey: ["transactions"],
    queryFn: fetchTransactions,
    placeholderData: fallbackTransactions,
    retry: 1,
  });

  // Winning from context (stored in DB now)
  const dollarWinnings = dollarWinning;
  const starWinnings = starWinning;
  const totalDollarWallet = dollarBalance + dollarWinnings;
  const totalStarWallet = starBalance + starWinnings;

  // Fetch TON price
  useQuery({
    queryKey: ["ton-price"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/ton/price`);
      const data = await res.json();
      setTonPrice(data.tonUsdPrice);
      return data.tonUsdPrice;
    },
    refetchInterval: 60000,
  });

  // ---- TON Deposit Handler ----
  const handleTonDeposit = async () => {
    const tonAmt = Number(tonDepositAmount);
    if (!tonAmt || tonAmt <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid TON amount.", variant: "destructive" });
      return;
    }
    if (!tonAddress) {
      toast({ title: "Wallet not connected", description: "Connect your TON wallet first.", variant: "destructive" });
      return;
    }

    setTonProcessing(true);
    try {
      const tg = getTelegram();
      const userId = tg?.initDataUnsafe?.user?.id || "demo";

      // Step 1: Init deposit on backend → get owner wallet & comment
      const initRes = await fetch(`${apiBase}/ton/init-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tonAmount: tonAmt }),
      });
      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || "Failed to init deposit");

      // Step 2: Send TON via TonConnect
      const nanoTon = BigInt(Math.floor(tonAmt * 1e9)).toString();

      // Dynamically import @ton/core to avoid Buffer issues at module load
      const { beginCell } = await import("@ton/core");
      const body = beginCell()
        .storeUint(0, 32) // comment opcode
        .storeStringTail(initData.depositComment)
        .endCell();
      const payloadBase64 = body.toBoc().toString("base64");

      const txResult = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: initData.ownerWallet,
            amount: nanoTon,
            payload: payloadBase64,
          },
        ],
      });

      // Step 3: Confirm deposit on backend
      const confirmRes = await fetch(`${apiBase}/ton/confirm-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          transactionId: initData.transactionId,
          bocHash: txResult.boc || "confirmed",
        }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error || "Failed to confirm deposit");

      toast({
        title: "TON Deposit Successful! ✅",
        description: `${tonAmt} TON ≈ $${initData.usdEquivalent.toFixed(2)} added to your wallet!`,
      });
      setTonDepositAmount("");
      refreshBalance();
    } catch (err: any) {
      if (err?.message?.includes("Rejected")) {
        toast({ title: "Cancelled", description: "Transaction was cancelled." });
      } else {
        toast({ title: "Error", description: err?.message || "TON deposit failed.", variant: "destructive" });
      }
    } finally {
      setTonProcessing(false);
    }
  };

  // ---- TON Withdraw Handler ----
  const handleTonWithdraw = async () => {
    const dollarAmt = Number(tonWithdrawAmount);
    if (!dollarAmt || dollarAmt < 10) {
      toast({ title: "Minimum $10", description: "Minimum withdrawal is $10.", variant: "destructive" });
      return;
    }
    if (dollarAmt > dollarBalance) {
      toast({ title: "Insufficient balance", description: "You don't have enough dollar balance.", variant: "destructive" });
      return;
    }
    if (!tonAddress) {
      toast({ title: "Wallet not connected", description: "Connect your TON wallet first.", variant: "destructive" });
      return;
    }

    setTonProcessing(true);
    try {
      const tg = getTelegram();
      const userId = tg?.initDataUnsafe?.user?.id || "demo";

      const res = await fetch(`${apiBase}/ton/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, dollarAmount: dollarAmt, tonWalletAddress: tonAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");

      toast({
        title: "Withdrawal Submitted! ✅",
        description: `$${dollarAmt} ≈ ${data.tonAmount.toFixed(4)} TON will be sent to your wallet.`,
      });
      setTonWithdrawAmount("");
      refreshBalance();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Withdrawal failed.", variant: "destructive" });
    } finally {
      setTonProcessing(false);
    }
  };

  // ---- Crypto (NOWPayments) Deposit Handler ----
  const handleCryptoDeposit = async () => {
    const usdAmt = Number(cryptoAmount);
    if (!usdAmt || usdAmt < 1) {
      toast({ title: "Invalid amount", description: "Please enter a valid USD amount.", variant: "destructive" });
      return;
    }

    setCryptoProcessing(true);
    try {
      const tg = getTelegram();
      const userId = tg?.initDataUnsafe?.user?.id || "demo";

      const apiCurrency = cryptoApiTicker[cryptoCurrency] || cryptoCurrency;
      const res = await fetch(`${apiBase}/crypto/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount: usdAmt, currency: apiCurrency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");

      // Show payment details in-app
      if (data.payAddress) {
        setCryptoPayment({
          payAddress: data.payAddress,
          payAmount: data.payAmount,
          payCurrency: data.payCurrency,
          orderId: data.orderId,
        });
        toast({
          title: "Payment Created! 🪙",
          description: `Send exactly ${data.payAmount} ${data.payCurrency.toUpperCase()} to the address shown below.`,
        });
        setCryptoAmount("");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Crypto deposit failed.", variant: "destructive" });
    } finally {
      setCryptoProcessing(false);
    }
  };

  const handleCurrencySelect = (action: ActionType, currency: CurrencyType) => {
    setAmountDialog({ open: true, action, currency });
  };

  const handleAmountConfirm = async (amount: number) => {
    const { action, currency } = amountDialog;
    setAmountDialog((prev) => ({ ...prev, open: false }));

    setLoading(true);
    try {
      await initiatePayment(action, currency, amount, (status) => {
        setLoading(false);
        if (status === "paid") {
          toast({
            title: "Success! ✅",
            description: `${action === "deposit" ? "Deposit" : "Withdrawal"} of ${currency === "dollar" ? "$" + amount : amount + " ⭐"} completed!`,
          });
          refreshBalance();
        } else if (status === "cancelled") {
          toast({ title: "Cancelled", description: "Payment was cancelled." });
        } else {
          toast({ title: "Failed", description: "Payment failed. Try again.", variant: "destructive" });
        }
      });
    } catch (err: any) {
      setLoading(false);
      const message = err?.message || "Could not connect to server.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleDeposit = (currency: CurrencyOption) => handleCurrencySelect("deposit", currency as CurrencyType);

  // Withdrawal submit handler (pending request with crypto address)
  const handleWithdrawSubmit = async () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 10) {
      toast({ title: "Minimum $10", description: "Minimum withdrawal amount is $10.", variant: "destructive" });
      return;
    }
    if (!withdrawAddress.trim()) {
      toast({ title: "Address required", description: "Enter your crypto wallet address.", variant: "destructive" });
      return;
    }
    const winField = withdrawCurrency === "dollar" ? dollarWinnings : starWinnings;
    if (amt > winField) {
      toast({ title: "Insufficient winnings", description: `You only have ${withdrawCurrency === "dollar" ? "$" + winField.toFixed(2) : winField + " ⭐"} in winnings.`, variant: "destructive" });
      return;
    }

    setWithdrawing(true);
    try {
      const tg = getTelegram();
      const userId = tg?.initDataUnsafe?.user?.id || "demo";
      const res = await fetch(`${apiBase}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          currency: withdrawCurrency,
          amount: amt,
          cryptoAddress: withdrawAddress.trim(),
          network: withdrawNetwork.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      toast({
        title: "Withdrawal Submitted! 📝",
        description: "Your request is pending admin approval. You'll get a notification when processed.",
      });
      setWithdrawDialog(false);
      refreshBalance();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Withdrawal failed.", variant: "destructive" });
    } finally {
      setWithdrawing(false);
    }
  };

  const starInputNum = Number(convertStars) || 0;
  const dollarOutput = (starInputNum / STAR_TO_DOLLAR_RATE).toFixed(2);

  const handleConvert = async () => {
    if (starInputNum < STAR_TO_DOLLAR_RATE) {
      toast({ title: "Minimum required", description: `Minimum ${STAR_TO_DOLLAR_RATE} ⭐ needed to convert.`, variant: "destructive" });
      return;
    }
    if (starInputNum > starBalance) {
      toast({ title: "Insufficient Stars", description: "You don't have enough Stars.", variant: "destructive" });
      return;
    }

    setConverting(true);
    try {
      const tg = getTelegram();
      const userId = tg?.initDataUnsafe?.user?.id || "demo";
      const apiBase = import.meta.env.VITE_API_BASE_URL || "https://broken-bria-chetan1-ea890b93.koyeb.app/api";
      const res = await fetch(`${apiBase}/convert-stars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, starAmount: starInputNum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Conversion failed");

      toast({
        title: "Converted! ✅",
        description: `${starInputNum} ⭐ → $${dollarOutput} added to your Dollar wallet.`,
      });
      setConvertStars("");
      refreshBalance();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Conversion failed.", variant: "destructive" });
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="px-3 pt-3 space-y-3">
      <h2 className="font-bold text-base text-foreground">Wallet</h2>

      {/* Balances */}
      <div className="grid grid-cols-2 gap-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-2.5 space-y-0.5"
        >
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-medium">
            <DollarSign className="h-3 w-3" /> Dollar ($)
          </div>
          <p className="font-bold text-base text-foreground">${totalDollarWallet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card border border-border rounded-xl p-2.5 space-y-0.5"
        >
          <div className="flex items-center justify-between gap-1">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-medium">
                <Star className="h-3 w-3" /> Stars
              </div>
              <p className="font-bold text-base text-foreground">{totalStarWallet.toLocaleString()}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[10px] border-primary/50 text-primary hover:bg-primary/10"
              onClick={() => {
                setAmountDialog({ open: true, action: "deposit", currency: "star" });
              }}
            >
              + Add
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Crypto Deposit (NOWPayments) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        id="crypto-deposit"
        className="bg-card border border-border rounded-2xl p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Crypto Deposit</h3>
        </div>
        <p className="text-xs text-muted-foreground">Pay with any crypto → Get $ in wallet</p>

        {/* Crypto selector */}
        <div className="flex flex-wrap gap-1.5">
          {["btc", "ltc", "ton", "sol", "trx", "doge"].map((coin) => (
            <button
              key={coin}
              onClick={() => setCryptoCurrency(coin)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex flex-col items-center ${
                cryptoCurrency === coin
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <span>{coin.toUpperCase()}</span>
              <span className="text-[9px] font-normal opacity-75">min ${cryptoMins[coin] || 1}</span>
            </button>
          ))}
        </div>

        {/* Amount input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              type="number"
              placeholder={`USD amount (min $${cryptoMins[cryptoCurrency] || 1})`}
              value={cryptoAmount}
              onChange={(e) => setCryptoAmount(e.target.value)}
              className="pr-8 rounded-xl bg-background"
              min={cryptoMins[cryptoCurrency] || 1}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
          </div>
          <Button
            className="rounded-xl"
            disabled={cryptoProcessing || !cryptoAmount}
            onClick={handleCryptoDeposit}
          >
            {cryptoProcessing ? "..." : <><ExternalLink className="h-4 w-4" /></>}
          </Button>
        </div>
        {/* Payment details shown in-app */}
        <AnimatePresence>
          {cryptoPayment && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-muted/50 border border-primary/30 rounded-xl p-3 space-y-2"
            >
              <p className="text-xs font-semibold text-foreground">
                Send exactly <span className="text-primary">{cryptoPayment.payAmount} {cryptoPayment.payCurrency.toUpperCase()}</span>
              </p>
              {/* QR Code */}
              <div className="flex justify-center py-2">
                <div className="bg-white p-3 rounded-xl">
                  <QRCodeSVG
                    value={cryptoPayment.payAddress}
                    size={180}
                    level="H"
                    includeMargin={false}
                  />
                </div>
              </div>
              <div className="bg-background border border-border rounded-lg p-2">
                <p className="text-[10px] font-semibold text-primary mb-1">
                  {cryptoPayment.payCurrency.toUpperCase()} Address:
                </p>
                <p className="text-xs font-mono text-foreground break-all select-all">{cryptoPayment.payAddress}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-lg text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(cryptoPayment.payAddress);
                  toast({ title: "Copied!", description: "Address copied to clipboard." });
                }}
              >
                📋 Copy Address
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Balance updates automatically after confirmation • Send exact amount only
              </p>
              {paymentStatus && paymentStatus !== "completed" && (
                <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-2">
                  <span className="animate-pulse text-primary text-lg">⏳</span>
                  <span className="text-xs font-medium text-foreground capitalize">
                    Status: {paymentStatus === "pending" ? "Waiting for payment..." : paymentStatus}
                  </span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setCryptoPayment(null)}
              >
                Close
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="text-[10px] text-muted-foreground">
          Powered by NOWPayments • Balance updates automatically after payment confirmation
        </p>
      </motion.div>

      {/* Winning Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="rounded-xl h-14 w-full border-green-500/30 text-green-500 hover:bg-green-500/10 flex flex-col items-center justify-center gap-0.5"
          onClick={() => {
            if (dollarWinnings < 10) {
              toast({ title: "Minimum $10", description: "You need at least $10 in winnings to withdraw.", variant: "destructive" });
              return;
            }
            setWithdrawCurrency("dollar");
            setWithdrawAmount("");
            setWithdrawAddress("");
            setWithdrawCrypto("btc");
            setWithdrawNetwork("Bitcoin");
            setWithdrawDialog(true);
          }}
        >
          <span className="flex items-center text-xs">
            <DollarSign className="h-3.5 w-3.5 mr-0.5" /> Winning Withdraw
          </span>
          <span className="text-sm font-bold">${dollarWinnings.toFixed(2)}</span>
        </Button>
        <Button
          variant="outline"
          className="rounded-xl h-14 w-full border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 flex flex-col items-center justify-center gap-0.5"
          onClick={() => {
            const el = document.getElementById("star-converter");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <span className="flex items-center text-xs">
            <Star className="h-3.5 w-3.5 mr-0.5" /> Winning Star Convert
          </span>
          <span className="text-sm font-bold">⭐ {starWinnings.toLocaleString()}</span>
        </Button>
      </div>

      {/* Withdraw */}
      <div className="grid grid-cols-1 gap-3">
        <Button
          variant="outline"
          className="rounded-xl h-12 w-full"
          onClick={() => {
            setWithdrawCurrency("dollar");
            setWithdrawAmount("");
            setWithdrawAddress("");
            setWithdrawCrypto("btc");
            setWithdrawNetwork("Bitcoin");
            setWithdrawDialog(true);
          }}
        >
          <ArrowUpRight className="h-4 w-4 mr-2" /> Withdraw
        </Button>
      </div>

      {/* Star to Dollar Converter */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        id="star-converter"
        className="bg-card border border-border rounded-2xl p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Star → Dollar Converter</h3>
        </div>
        <p className="text-xs text-muted-foreground">Rate: {STAR_TO_DOLLAR_RATE} ⭐ = $1.00</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Input
              type="number"
              placeholder={`Min ${STAR_TO_DOLLAR_RATE}`}
              value={convertStars}
              onChange={(e) => setConvertStars(e.target.value)}
              className="pr-8 rounded-xl bg-background"
              min={STAR_TO_DOLLAR_RATE}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">⭐</span>
          </div>
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="bg-muted/50 border border-border rounded-xl px-3 py-2 min-w-[80px] text-center">
            <span className="font-bold text-sm text-foreground">${dollarOutput}</span>
          </div>
        </div>
        <Button
          className="w-full rounded-xl h-10"
          disabled={converting || starInputNum < STAR_TO_DOLLAR_RATE}
          onClick={handleConvert}
        >
          {converting ? "Converting..." : `Convert ${starInputNum > 0 ? starInputNum + " ⭐" : ""}`}
        </Button>
      </motion.div>

      {/* Transactions */}
      <div>
        <h3 className="font-semibold text-foreground text-sm mb-3">Recent Transactions</h3>
        <div className="space-y-2">
        {transactions.map((tx: any, i: number) => {
            const isCancelled = tx.status === "failed" || tx.status === "refunded";
            const isPositive = !isCancelled && (tx.type === "win" || tx.type === "bonus" || tx.type === "deposit" || tx.type === "ton_deposit" || tx.type === "referral");
            const isTonTx = tx.type === "ton_deposit" || tx.type === "ton_withdraw";
            const isStarTx = tx.currency === "star";
            const currencySymbol = isStarTx ? "⭐" : "$";
            // For TON transactions, show USD equivalent; for star show star amount
            const displayValue = isTonTx && tx.usdEquivalent
              ? Number(tx.usdEquivalent).toFixed(2)
              : String(tx.amount).replace(/^[+-]/, "");
            const rawAmount = displayValue;
            const displayAmount = isCancelled
              ? rawAmount
              : (isPositive ? "+" : "-") + rawAmount;
            const timeDisplay = tx.time || (tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "");

            const iconColor = isCancelled ? "bg-yellow-500/20" : isPositive ? "bg-green-500/20" : "bg-red-500/20";
            const textColor = isCancelled ? "text-yellow-500" : isPositive ? "text-green-500" : "text-red-500";

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3"
              >
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${iconColor}`}>
                  {isCancelled ? (
                    <span className="text-yellow-500 text-xs font-bold">✕</span>
                  ) : isPositive ? (
                    <ArrowDownLeft className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-foreground">
                    {isCancelled ? `Cancelled: ${tx.description || tx.type}` : (tx.game || tx.description || tx.type)}
                  </h4>
                  <p className="text-xs text-muted-foreground">{timeDisplay}</p>
                </div>
                <span className={`text-sm font-bold ${textColor}`}>
                  {currencySymbol} {isCancelled ? "Cancel" : displayAmount}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Withdrawal Dialog with Crypto Address */}
      <AnimatePresence>
        {withdrawDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60"
              onClick={() => setWithdrawDialog(false)}
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={() => setWithdrawDialog(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4 w-full max-h-[85vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-foreground">
                    Withdraw $
                  </h3>
                  <button onClick={() => setWithdrawDialog(false)} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground rotate-45" />
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Available: ${dollarWinnings.toFixed(2)} (from winnings) • Min $10
                </p>

                {/* Crypto selector */}
                <div className="grid grid-cols-4 gap-2">
                  {withdrawCryptoOptions.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setWithdrawCrypto(c.id);
                        setWithdrawNetwork(c.network);
                      }}
                      className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                        withdrawCrypto === c.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <Input
                  type="text"
                  placeholder={`Your ${withdrawCryptoOptions.find(c => c.id === withdrawCrypto)?.label || ''} address`}
                  value={withdrawAddress}
                  onChange={e => setWithdrawAddress(e.target.value)}
                  className="rounded-xl bg-muted/30 font-mono text-xs"
                />

                <Input
                  type="number"
                  placeholder="Amount (min $10)"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  className="rounded-xl bg-muted/30"
                  min="10"
                />

                <Button
                  onClick={handleWithdrawSubmit}
                  disabled={withdrawing || !withdrawAmount || !withdrawAddress.trim() || parseFloat(withdrawAmount) < 10}
                  className="w-full rounded-xl h-12 font-bold"
                >
                  {withdrawing ? "Submitting..." : `Withdraw via ${withdrawCryptoOptions.find(c => c.id === withdrawCrypto)?.label || ''}`}
                </Button>

                <p className="text-[10px] text-muted-foreground text-center">
                  ⏳ Admin will review and approve your request. You'll get a Telegram notification.
                </p>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Amount Input Dialog */}
      <AmountInputDialog
        open={amountDialog.open}
        onClose={() => setAmountDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={handleAmountConfirm}
        currency={amountDialog.currency}
        action={amountDialog.action}
      />
    </div>
  );
};

export default WalletScreen;
