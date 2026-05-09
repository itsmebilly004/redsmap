// src/routes/index.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopShell } from "@/components/top-shell";
import { DerivChart } from "@/components/deriv-chart";
import { TradePanel } from "@/components/trade-panel";
import { 
  Shield, 
  Sun, 
  HelpCircle, 
  Settings, 
  Globe, 
  Bot, 
  Crosshair, 
  Maximize2, 
  BarChart2, 
  TrendingUp 
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ArkTrader Hub — Real-time Deriv Trading Platform" },
      { 
        name: "description", 
        content: "Trade synthetic indices in real time with live Deriv charts, digit analysis, and accumulator barriers." 
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  
  // --- STATE ---
  const [symbol, setSymbol] = useState("1HZ100V");
  const [category, setCategory] = useState<string>("accumulator"); // Controls chart overlays (digits/barriers)
  const [price, setPrice] = useState<number | null>(null);
  const [barriers, setBarriers] = useState<{ high: number | null; low: number | null }>({ 
    high: null, 
    low: null 
  });
  const [mobileTab, setMobileTab] = useState<"chart" | "trade">("chart");

  // --- OAUTH REDIRECT HANDLING ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    
    // If we have account/token params, we were just redirected from Deriv OAuth
    if (params.get("acct1") && params.get("token1")) {
      window.location.replace(`/deriv-callback${window.location.search}`);
    }
    
    // Handle error params from OAuth
    if (params.get("error")) {
      navigate({ to: "/auth", search: { mode: "signin" } });
    }
  }, [navigate]);

  return (
    <TopShell>
      {/* Mobile view tab switcher (Emerald Green Branding) */}
      <div className="flex border-b border-[oklch(0.92_0.005_240)] bg-white lg:hidden">
        <button
          onClick={() => setMobileTab("chart")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-bold transition-all",
            mobileTab === "chart"
              ? "border-b-2 border-[oklch(0.7_0.17_150)] text-[oklch(0.35_0.15_150)] bg-[oklch(0.7_0.17_150)]/5"
              : "text-slate-400"
          )}
        >
          <BarChart2 className="size-4" /> Chart
        </button>
        <button
          onClick={() => setMobileTab("trade")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-bold transition-all",
            mobileTab === "trade"
              ? "border-b-2 border-[oklch(0.7_0.17_150)] text-[oklch(0.35_0.15_150)] bg-[oklch(0.7_0.17_150)]/5"
              : "text-slate-400"
          )}
        >
          <TrendingUp className="size-4" /> Trade
        </button>
      </div>

      {/* Main Desktop/Tablet Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] h-[calc(100vh-120px)] min-h-[600px]">
        
        {/* CHART SECTION */}
        <section
          className={cn(
            "relative bg-[#f8f9fa] p-4 lg:p-6 transition-all",
            mobileTab !== "chart" && "hidden lg:block"
          )}
        >
          {/* Chart Header Info */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manual Terminal</div>
              <div className="flex items-baseline gap-2">
                <h2 className="text-xl font-bold text-[#333]">Market Analysis</h2>
                <span className="font-mono text-sm font-bold text-[oklch(0.7_0.17_150)]">
                  {price !== null ? price.toFixed(4) : "Connecting..."}
                </span>
              </div>
            </div>
            
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-white border border-[#e5e5e5] px-3 py-1 text-[10px] font-bold text-slate-500">
               <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live WebSocket Stream
            </div>
          </div>

          <DerivChart
            symbol={symbol}
            category={category} // Used to show/hide digit circles or barriers
            onSymbolChange={setSymbol}
            onPrice={setPrice}
            height={500}
            highBarrier={barriers.high}
            lowBarrier={barriers.low}
            className="w-full"
          />

          <div className="mt-4 flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 p-4">
             <Info className="size-5 text-blue-500 shrink-0 mt-0.5" />
             <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
               ArkTrader Hub acts as a high-performance interface for Deriv. Live data is streamed directly 
               from the exchange. Chart overlays like <strong>Accumulator Barriers</strong> or <strong>Digit Frequency</strong> 
               are updated in real-time based on your trade selection.
             </p>
          </div>
        </section>

        {/* TRADE PANEL ASIDE */}
        <aside
          className={cn(
            "flex flex-col border-l border-[oklch(0.92_0.005_240)] bg-white p-6 shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-10",
            mobileTab === "trade" ? "flex" : "hidden lg:flex"
          )}
        >
          <TradePanel 
            market={symbol} 
            lastPrice={price} 
            onCategoryChange={setCategory} // Important: Updates the Chart UI
            onAccumulatorBarriers={setBarriers} 
          />
        </aside>
      </div>

      {/* FOOTER BAR (Branded) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[oklch(0.92_0.005_240)] bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-[oklch(0.92_0.13_95)] px-3 py-1.5 text-[11px] font-black uppercase text-[oklch(0.3_0.1_80)] border border-[oklch(0.3_0.1_80)]/10">
            Risk Disclaimer
          </span>
          <p className="hidden md:block text-[11px] font-bold text-slate-400">
            Trading involves significant risk of loss. Always use a Demo account before going live.
          </p>
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          <div className="flex items-center gap-3 font-mono text-xs font-bold border-r pr-4 border-[#e5e5e5]">
            <Shield className="size-4 text-emerald-500" />
            <Bot className="size-4" />
            <Crosshair className="size-4" />
            <Settings className="size-4 hover:rotate-90 transition-transform cursor-pointer" />
          </div>
          <div className="flex items-center gap-3 font-mono text-xs font-bold">
            <Globe className="size-4" />
            <span className="font-sans">EN</span>
            <Maximize2 className="size-4 hover:scale-110 transition-transform cursor-pointer" />
          </div>
        </div>
      </div>
    </TopShell>
  );
}