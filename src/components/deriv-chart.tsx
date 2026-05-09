// src/components/deriv-chart.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  AreaSeries,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type CandlestickData,
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

type ChartType = "area" | "candle";

type Props = {
  symbol: string;
  category?: string; // New: to detect if we should show digits
  onSymbolChange?: (s: string) => void;
  onPrice?: (price: number) => void;
  height?: number;
  className?: string;
  highBarrier?: number | null;
  lowBarrier?: number | null;
};

const TIMEFRAMES = [
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
  { label: "1H", value: 3600 },
];

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
  const candleBufferRef = useRef<Map<number, Candle>>(new Map());

  const [granularity, setGranularity] = useState(60);
  const [chartType, setChartType] = useState<ChartType>("area");
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [allSymbols, setAllSymbols] = useState<{ symbol: string; display_name: string; market: string }[]>([]);
  
  // Digit analysis state
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  const [digitHistory, setDigitHistory] = useState<number[]>([]);

  const isDigitTrade = ["even_odd", "over_under", "matches_differs"].includes(category ?? "");
  const isAccumulator = category === "accumulator";

  useEffect(() => {
    getActiveSymbols().then((list) => { if (list?.length) setAllSymbols(list); });
    const off = onStatus(setStatus);
    return () => { off(); };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#64748b", fontFamily: "Inter, sans-serif" },
      grid: { vertLines: { color: "rgba(0,0,0,0.04)" }, horzLines: { color: "rgba(0,0,0,0.04)" } },
      rightPriceScale: { borderColor: "rgba(0,0,0,0.08)" },
      timeScale: { borderColor: "rgba(0,0,0,0.08)", timeVisible: true, secondsVisible: granularity < 60 },
      crosshair: { mode: 1 },
    });

    if (chartType === "candle") {
      candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e", downColor: "#ef4444", borderUpColor: "#22c55e", borderDownColor: "#ef4444",
        wickUpColor: "#22c55e", wickDownColor: "#ef4444",
      }) as ISeriesApi<"Candlestick">;
    } else {
      areaSeriesRef.current = chart.addSeries(AreaSeries, {
        lineColor: "#334155", lineWidth: 2, topColor: "rgba(51,65,85,0.1)", bottomColor: "rgba(51,65,85,0)",
      }) as ISeriesApi<"Area">;
    }

    chartRef.current = chart;
    return () => chart.remove();
  }, [chartType]);

  useEffect(() => {
    let cancelled = false;
    let unsubTicks: (() => void) | undefined;
    candleBufferRef.current.clear();

    async function init() {
      const candles = await fetchCandles(symbol, granularity, 300);
      if (cancelled) return;

      if (chartType === "candle" && candleSeriesRef.current) {
        candleSeriesRef.current.setData(candles.map(c => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
      } else if (chartType === "area" && areaSeriesRef.current) {
        areaSeriesRef.current.setData(candles.map(c => ({ time: c.time as UTCTimestamp, value: c.close })));
      }

      unsubTicks = await subscribeTicks(symbol, (price, t) => {
        if (cancelled) return;
        onPrice?.(price);
        
        // Update Digit Logic
        const digit = Number(price.toFixed(2).split('').pop());
        setLastDigit(digit);
        setDigitHistory(prev => [...prev.slice(-99), digit]);

        if (chartType === "area" && areaSeriesRef.current) {
          areaSeriesRef.current.update({ time: t as UTCTimestamp, value: price });
        } else if (chartType === "candle" && candleSeriesRef.current) {
          const barTime = Math.floor(t / granularity) * granularity;
          const existing = candleBufferRef.current.get(barTime);
          const bar = existing 
            ? { ...existing, high: Math.max(existing.high, price), low: Math.min(existing.low, price), close: price }
            : { time: barTime, open: price, high: price, low: price, close: price };
          candleBufferRef.current.set(barTime, bar);
          candleSeriesRef.current.update({ time: barTime as UTCTimestamp, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
        }
      });
    }

    init();
    return () => { cancelled = true; unsubTicks?.(); };
  }, [symbol, granularity, chartType]);

  // Barrier Rendering (Accumulators)
  useEffect(() => {
    const series = areaSeriesRef.current ?? candleSeriesRef.current;
    if (!series) return;
    if (highLineRef.current) series.removePriceLine(highLineRef.current);
    if (lowLineRef.current) series.removePriceLine(lowLineRef.current);

    if (highBarrier) {
      highLineRef.current = series.createPriceLine({
        price: highBarrier, color: "#2196f3", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `+${(highBarrier - (highBarrier + lowBarrier!)/2).toFixed(3)}`
      });
    }
    if (lowBarrier) {
      lowLineRef.current = series.createPriceLine({
        price: lowBarrier, color: "#2196f3", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `-${((highBarrier! + lowBarrier)/2 - lowBarrier).toFixed(3)}`
      });
    }
  }, [highBarrier, lowBarrier]);

  const digitStats = useMemo(() => {
    const counts = new Array(10).fill(0);
    digitHistory.forEach(d => counts[d]++);
    const total = digitHistory.length || 1;
    return counts.map(c => ((c / total) * 100).toFixed(1));
  }, [digitHistory]);

  return (
    <div className={cn("relative group", className)}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={symbol} onValueChange={onSymbolChange}>
          <SelectTrigger className="w-56 h-10 bg-white border-[#e5e5e5] rounded-xl font-bold text-[#333]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {SYNTHETIC_MARKETS.map((m) => (
              <SelectItem key={m.symbol} value={m.symbol}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex bg-[#f2f3f4] p-1 rounded-xl border border-[#e5e5e5]">
          {TIMEFRAMES.map((tf) => (
            <button key={tf.value} onClick={() => setGranularity(tf.value)} className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition", granularity === tf.value ? "bg-white text-[#333] shadow-sm" : "text-slate-500 hover:text-[#333]")}>
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} style={{ height }} className="w-full bg-white border border-[#e5e5e5] rounded-[32px] overflow-hidden shadow-inner" />

      {/* DERIV DIGIT OVERLAY */}
      {isDigitTrade && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/90 backdrop-blur border border-[#e5e5e5] p-2 rounded-2xl shadow-xl z-10 scale-90 sm:scale-100">
          {digitStats.map((pct, i) => (
            <div key={i} className="flex flex-col items-center w-10">
              <div className={cn(
                "size-8 flex items-center justify-center rounded-full border-2 text-xs font-black transition-all",
                lastDigit === i ? "bg-[oklch(0.7_0.17_150)] border-[oklch(0.45_0.17_150)] text-white scale-110 shadow-lg" : "bg-[#f8f9fa] border-[#e5e5e5] text-slate-400"
              )}>
                {i}
              </div>
              <span className="text-[9px] font-bold text-slate-500 mt-1">{pct}%</span>
            </div>
          ))}
        </div>
      )}

      {/* ACCUMULATOR STATS OVERLAY */}
      {isAccumulator && (
        <div className="absolute top-20 right-6 flex flex-col gap-2 z-10 animate-in fade-in slide-in-from-right-4">
           <div className="bg-white/90 backdrop-blur border border-blue-100 p-3 rounded-2xl shadow-lg">
              <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Safety Range</div>
              <div className="text-sm font-mono font-bold text-slate-700">
                {lowBarrier?.toFixed(2)} - {highBarrier?.toFixed(2)}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}