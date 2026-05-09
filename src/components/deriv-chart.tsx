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
  getActiveSymbols,
  onStatus,
  subscribeTicks,
  SYNTHETIC_MARKETS,
  type ConnectionStatus,
  type Candle,
} from "@/lib/deriv";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

type ChartType = "area" | "candle";

type Props = {
  symbol: string;
  category?: string; // e.g. "over_under", "even_odd", "matches_differs"
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
  7: "border-[#3b82f6] text-[#3b82f6] bg-white ring-4 ring-blue-100",
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
  
  // Digit History State (Stored up to 1000 for accurate distribution)
  const [digitHistory, setDigitHistory] = useState<number[]>([]);
  const lastDigit = digitHistory[digitHistory.length - 1];

  const isDigitTrade = ["even_odd", "over_under", "matches_differs"].includes(category ?? "");

  useEffect(() => {
    const off = onStatus(setStatus);
    return () => off();
  }, []);

  // Initialize Chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#94a3b8", fontFamily: "Inter, sans-serif" },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(0,0,0,0.03)" } },
      rightPriceScale: { borderColor: "rgba(0,0,0,0.05)" },
      timeScale: { borderColor: "rgba(0,0,0,0.05)", timeVisible: true },
    });

    if (chartType === "candle") {
      candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e", downColor: "#ef4444", borderVisible: false, wickUpColor: "#22c55e", wickDownColor: "#ef4444",
      }) as ISeriesApi<"Candlestick">;
    } else {
      areaSeriesRef.current = chart.addSeries(AreaSeries, {
        lineColor: "#475569", lineWidth: 2, topColor: "rgba(71,85,105,0.08)", bottomColor: "transparent",
      }) as ISeriesApi<"Area">;
    }

    chartRef.current = chart;
    return () => chart.remove();
  }, [chartType]);

  // Tick Subscription
  useEffect(() => {
    let unsub: (() => void) | undefined;
    async function init() {
      unsub = await subscribeTicks(symbol, (price, t) => {
        onPrice?.(price);
        
        // Extract Last Digit
        const digit = parseInt(price.toFixed(2).slice(-1));
        setDigitHistory(prev => [...prev.slice(-999), digit]);

        if (chartType === "area" && areaSeriesRef.current) {
          areaSeriesRef.current.update({ time: t as UTCTimestamp, value: price });
        }
      });
    }
    init();
    return () => unsub?.();
  }, [symbol, chartType]);

  // Distribution Logic
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
      isLeast: pcts[i] === minVal && total > 10,
    }));
  }, [digitHistory]);

  return (
    <div className={cn("relative flex flex-col gap-4", className)}>
      {/* Chart Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Select value={symbol} onValueChange={onSymbolChange}>
            <SelectTrigger className="w-52 h-9 rounded-lg bg-white border-slate-200 font-bold text-slate-700 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYNTHETIC_MARKETS.map(m => <SelectItem key={m.symbol} value={m.symbol}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="px-2 py-1 rounded bg-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-tighter border border-slate-200">1T</div>
        </div>
        
        <div className={cn("text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest", 
          status === 'connected' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100")}>
          {status}
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div ref={containerRef} style={{ height }} className="w-full bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-sm relative" />

      {/* DCIRCLES VISUALIZATION (Shows only for relevant trade types) */}
      {isDigitTrade && (
        <div className="mt-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <h4 className="text-sm font-bold text-slate-700 mb-6">Last 1000 ticks — digit distribution</h4>
          
          <div className="flex items-end justify-between max-w-4xl mx-auto px-4">
            {stats.map((s) => (
              <div key={s.digit} className="flex flex-col items-center group">
                {/* Selection Indicator Arrow */}
                <div className="h-6 mb-1">
                  {lastDigit === s.digit && (
                    <div className="w-4 h-4 bg-blue-600 rounded-sm rotate-45 flex items-center justify-center shadow-md animate-bounce">
                       <div className="size-1 bg-white rounded-full" />
                    </div>
                  )}
                </div>

                {/* The Digit Circle */}
                <div className={cn(
                  "size-12 rounded-full border-2 flex items-center justify-center text-lg font-black transition-all duration-300",
                  lastDigit === s.digit ? "scale-110 shadow-lg" : "opacity-80",
                  DIGIT_CONFIG[s.digit]
                )}>
                  {s.digit}
                </div>

                {/* Counters & Labels */}
                <div className="mt-2 flex flex-col items-center">
                  <span className="text-[11px] font-bold text-slate-800">{s.count}</span>
                  <span className="text-[11px] text-slate-500">{s.pct}%</span>
                  
                  <div className="h-4 mt-0.5">
                    {s.isMost && (
                      <span className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-0.5">
                        <ChevronDown className="size-2 rotate-180" /> most
                      </span>
                    )}
                    {s.isLeast && (
                      <span className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-0.5">
                        <ChevronDown className="size-2" /> least
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-400">
              current digit: <span className="text-slate-900 font-bold">{lastDigit ?? "—"}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}