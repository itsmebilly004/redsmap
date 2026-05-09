import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  AreaSeries,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  fetchCandles,
  onStatus,
  subscribeTicks,
  SYNTHETIC_MARKETS,
  type ConnectionStatus,
} from "@/lib/deriv";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronDown, Info } from "lucide-react";

type ChartType = "area" | "candle";

type Props = {
  symbol: string;
  category?: string; // Toggles Dcircles (e.g., "over_under", "even_odd", "matches_differs")
  onSymbolChange?: (s: string) => void;
  onPrice?: (price: number) => void;
  height?: number;
  className?: string;
  highBarrier?: number | null;
  lowBarrier?: number | null;
};

// Map digit to the specific color scheme in your image
const DIGIT_CONFIG: Record<number, string> = {
  0: "border-slate-200 text-slate-600 bg-white",
  1: "bg-[#f59e0b] border-[#f59e0b] text-white",
  2: "bg-[#ef4444] border-[#ef4444] text-white",
  3: "border-slate-200 text-slate-600 bg-white",
  4: "bg-[#10b981] border-[#10b981] text-white",
  5: "bg-[#0ea5e9] border-[#0ea5e9] text-white",
  6: "bg-[#f97316] border-[#f97316] text-white",
  7: "border-[#3b82f6] text-[#3b82f6] bg-white ring-4 ring-blue-100", // The special ring for 7
  8: "border-slate-200 text-slate-600 bg-white",
  9: "border-slate-200 text-slate-600 bg-white",
};

export function DerivChart({
  symbol,
  category,
  onSymbolChange,
  onPrice,
  height = 420,
  className,
  highBarrier,
  lowBarrier,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const highLineRef = useRef<IPriceLine | null>(null);
  const lowLineRef = useRef<IPriceLine | null>(null);

  const [granularity, setGranularity] = useState(60);
  const [chartType, setChartType] = useState<ChartType>("area");
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  
  // Digit History State (Buffers 1000 ticks for distribution stats)
  const [digitHistory, setDigitHistory] = useState<number[]>([]);
  const lastDigit = digitHistory[digitHistory.length - 1];

  // Logic: Show Dcircles only for Digit-based trade types
  const isDigitTrade = ["even_odd", "over_under", "matches_differs"].includes(category ?? "");

  useEffect(() => {
    const off = onStatus(setStatus);
    return () => off();
  }, []);

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { 
        background: { color: "transparent" }, 
        textColor: "#64748b", 
        fontFamily: "Inter, system-ui, sans-serif" 
      },
      grid: { 
        vertLines: { visible: false }, 
        horzLines: { color: "rgba(0,0,0,0.03)" } 
      },
      rightPriceScale: { 
        borderColor: "rgba(0,0,0,0.05)",
        autoScale: true,
      },
      timeScale: { 
        borderColor: "rgba(0,0,0,0.05)", 
        timeVisible: true,
        secondsVisible: granularity < 60,
      },
      crosshair: { mode: 1 },
    });

    if (chartType === "candle") {
      candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e", 
        downColor: "#ef4444", 
        borderVisible: false, 
        wickUpColor: "#22c55e", 
        wickDownColor: "#ef4444",
      }) as ISeriesApi<"Candlestick">;
    } else {
      areaSeriesRef.current = chart.addSeries(AreaSeries, {
        lineColor: "#334155", 
        lineWidth: 2, 
        topColor: "rgba(51,65,85,0.08)", 
        bottomColor: "transparent",
      }) as ISeriesApi<"Area">;
    }

    chartRef.current = chart;
    return () => {
        chart.remove();
    };
  }, [chartType, granularity]);

  // Tick Subscription & Digit Extraction
  useEffect(() => {
    let unsub: (() => void) | undefined;
    async function init() {
      unsub = await subscribeTicks(symbol, (price, t) => {
        onPrice?.(price);
        
        // Extract Last Digit (e.g., 1428.57 -> 7)
        const digit = parseInt(price.toFixed(2).slice(-1));
        setDigitHistory(prev => [...prev.slice(-999), digit]);

        if (chartType === "area" && areaSeriesRef.current) {
          areaSeriesRef.current.update({ time: t as UTCTimestamp, value: price });
        }
      });
    }
    init();
    return () => { if (unsub) unsub(); };
  }, [symbol, chartType]);

  // Accumulator Barrier Lines
  useEffect(() => {
    const series = areaSeriesRef.current ?? candleSeriesRef.current;
    if (!series) return;
    if (highLineRef.current) series.removePriceLine(highLineRef.current);
    if (lowLineRef.current) series.removePriceLine(lowLineRef.current);

    if (highBarrier) {
      highLineRef.current = series.createPriceLine({
        price: highBarrier, color: "#3b82f6", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Upper'
      });
    }
    if (lowBarrier) {
      lowLineRef.current = series.createPriceLine({
        price: lowBarrier, color: "#3b82f6", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Lower'
      });
    }
  }, [highBarrier, lowBarrier]);

  // Compute Statistics for Dcircles
  const stats = useMemo(() => {
    const counts = new Array(10).fill(0);
    digitHistory.forEach(d => counts[d]++);
    const total = digitHistory.length || 1;
    
    const pcts = counts.map(c => (c / total) * 100);
    const maxVal = Math.max(...pcts);
    const minVal = Math.min(...pcts);

    return counts.map((count, i) => ({
      digit: i,
      count,
      pct: pcts[i].toFixed(1),
      isMost: pcts[i] === maxVal && maxVal > 0,
      isLeast: pcts[i] === minVal && total > 50, // Only show "least" after enough data
    }));
  }, [digitHistory]);

  return (
    <div className={cn("relative flex flex-col gap-4 w-full", className)}>
      {/* Header / Selector Area */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
           <Select value={symbol} onValueChange={onSymbolChange}>
            <SelectTrigger className="w-56 h-9 rounded-xl bg-white border-slate-200 font-bold text-slate-700 shadow-sm transition-all hover:border-blue-400">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYNTHETIC_MARKETS.map(m => (
                <SelectItem key={m.symbol} value={m.symbol} className="font-medium">{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase text-slate-500 border border-slate-200">1 Tick</div>
        </div>
        
        <div className={cn("text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border transition-colors", 
          status === 'connected' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100")}>
          {status}
        </div>
      </div>

      {/* Main Graph */}
      <div 
        ref={containerRef} 
        style={{ height }} 
        className="w-full bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm relative group" 
      />

      {/* DCIRCLES: DIGIT DISTRIBUTION (Matching provided reference image) */}
      {isDigitTrade && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="flex items-center justify-between mb-8">
            <h4 className="text-sm font-bold text-slate-800 tracking-tight">Last 1000 ticks — digit distribution</h4>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
              <Info className="size-3" /> Live Data
            </div>
          </div>
          
          <div className="flex items-end justify-between max-w-5xl mx-auto px-2">
            {stats.map((s) => (
              <div key={s.digit} className="flex flex-col items-center group relative">
                {/* Indicator Arrow (Blue Diamond) */}
                <div className="h-8 flex items-center justify-center mb-1">
                  {lastDigit === s.digit && (
                    <div className="w-5 h-5 bg-[#3b82f6] rounded-sm rotate-45 flex items-center justify-center shadow-lg shadow-blue-200 animate-bounce">
                       <div className="size-1 bg-white rounded-full" />
                    </div>
                  )}
                </div>

                {/* The Digit Circle */}
                <div className={cn(
                  "size-12 rounded-full border-2 flex items-center justify-center text-lg font-black transition-all duration-300",
                  lastDigit === s.digit ? "scale-110 z-10" : "opacity-90 grayscale-[20%]",
                  DIGIT_CONFIG[s.digit]
                )}>
                  {s.digit}
                </div>

                {/* Data Labels */}
                <div className="mt-3 flex flex-col items-center">
                  <span className="text-[12px] font-bold text-slate-900">{s.count}</span>
                  <span className="text-[11px] font-medium text-slate-400">{s.pct}%</span>
                  
                  {/* High/Low Frequency Badges */}
                  <div className="h-5 mt-1">
                    {s.isMost && (
                      <span className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-0.5 animate-pulse">
                        <ChevronDown className="size-2.5 rotate-180" /> most
                      </span>
                    )}
                    {s.isLeast && (
                      <span className="text-[10px] font-black text-slate-300 uppercase flex items-center gap-0.5">
                        <ChevronDown className="size-2.5" /> least
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-50 flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Current Digit Signal: <span className="text-blue-600 font-black ml-1 text-sm">{lastDigit ?? "—"}</span>
            </div>
            <div className="text-[10px] text-slate-300 font-bold">STOCHASTIC ANALYSIS ENGINE V2</div>
          </div>
        </div>
      )}
    </div>
  );
}