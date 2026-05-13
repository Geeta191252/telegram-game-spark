import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { BalanceProvider } from "@/contexts/BalanceContext";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import Index from "./pages/Index";
import GreedyKingGame from "./pages/GreedyKingGame";
import DiceMasterGame from "./pages/DiceMasterGame";
import CarnivalSpinGame from "./pages/CarnivalSpinGame";
import MinesGame from "./pages/MinesGame";
import AviatorGame from "./pages/AviatorGame";
import PlinkoGame from "./pages/PlinkoGame";
import ChickenRoadGame from "./pages/ChickenRoadGame";
import DragonTigerGame from "./pages/DragonTigerGame";

import AdminPanel from "./pages/AdminPanel";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

// Map startapp params (from Telegram bot deep links) to in-app routes.
const STARTAPP_GAME_ROUTES: Record<string, string> = {
  g_aviator: "/aviator",
  g_mines: "/mines",
  g_dice: "/dice-master",
  g_carnival: "/carnival-spin",
  g_greedy: "/greedy-king",
  g_plinko: "/plinko",
  g_chicken: "/chicken-road",
  g_dragontiger: "/dragon-tiger",
  
};

const StartParamNavigator = () => {
  const navigate = useNavigate();
  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      const param: string | undefined = tg?.initDataUnsafe?.start_param;
      if (!param) return;
      const target = STARTAPP_GAME_ROUTES[param];
      if (target) navigate(target, { replace: true });
    } catch {
      // ignore
    }
  }, [navigate]);
  return null;
};

const App = () => (
  <TonConnectUIProvider manifestUrl={manifestUrl}>
    <QueryClientProvider client={queryClient}>
      <BalanceProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <StartParamNavigator />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/greedy-king" element={<GreedyKingGame />} />
              <Route path="/dice-master" element={<DiceMasterGame />} />
              <Route path="/carnival-spin" element={<CarnivalSpinGame />} />
              <Route path="/mines" element={<MinesGame />} />
              <Route path="/aviator" element={<AviatorGame />} />
              <Route path="/plinko" element={<PlinkoGame />} />
              <Route path="/chicken-road" element={<ChickenRoadGame />} />
              
              <Route path="/admin" element={<AdminPanel />} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </BalanceProvider>
    </QueryClientProvider>
  </TonConnectUIProvider>
);

export default App;
