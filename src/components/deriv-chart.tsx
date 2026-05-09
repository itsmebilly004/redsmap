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
import { Info } from "lucide-react";

type ChartType = "area" | "candle";

type Props = {
  symbol: string;
  category?: string; // Toggles Dcircles based on trade type (e.g. over_under, even_odd)
  onSymbolChange?: (s: string) => void;
  onPrice?: (price: number) => void;
  height?: number;
  className?: string;
  highBarrier?: number | null;
  lowBarrier?: number | null;
};

const TIMEFRAMES = [
  { label: "1m",  value: 60 },
  { label: "5m",  value: 300 },
  { label: "15m", value: 900 },
  { label: "1H",  value: 3600 },
  { label: "4H",  value: 14400 },
  { label: "1D",  value: 86400 },
];

const STATUS_STYLE: Record<ConnectionStatus, string> = {
  connecting:    "bg-yellow-400/20 text-yellow-600",
  connected:     "bg-green-500/20 text-green-600",
  reconnecting:  "bg-orange-500/20 text-orange-600",
  disconnected:  "bg-red-500/20 text-red-600",
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
  const containerRef    = useRef<HTMLDivElement | null>(null);
  const chartRef        = useRef<IChartApi | null>(null);
  const areaSeriesRef   = useRef<ISeriesApi<"Area"> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const highLineRef     = useRef<IPriceLine | null>(null);
  const lowLineRef      = useRef<IPriceLine | null>(null);
  const candleBufferRef = useRef<Map<number, Candle>>(new Map());

  const [granularity, setGranularity] = useState(60);
  const [chartType, setChartType] = useState<ChartType>("area");
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [allSymbols, setAllSymbols] =
    useState<{ symbol: string; display_name: string; market: string }[]>([]);

  // Digit distribution state (1000 tick window)
  const [digitHistory, setDigitHistory] = useState<number[]>([]);
  const lastDigit = digitHistory[digitHistory.length - 1];

  // Show Dcircles for these categories
  const isDigitTrade = ["even_odd", "over_under", "matches_differs"].includes(category ?? "");

  useEffect(() => {
    getActiveSymbols()
      .then((list) => { if (list?.length) setAllSymbols(list); })
      .catch(() => {
        setAllSymbols(
          SYNTHETIC_MARKETS.map((m) => ({ symbol: m.symbol, display_name: m.name, market: "synthetic_index" })),
        );
      });
  }, []);

  useEffect(() => {
    const off = onStatus(setStatus);
    return () => { off(); };
  }, []);

  // Initialize Chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(120,120,140,0.9)",
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(120,120,140,0.05)" },
      },
      rightPriceScale: { borderColor: "rgba(120,120,140,0.1)" },
      timeScale: {
        borderColor: "rgba(120,120,140,0.1)",
        timeVisible: true,
        secondsVisible: granularity < 60,
      },
      crosshair: { mode: 1 },
    });

    if (chartType === "candle") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor:   "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor:   "#22c55e",
        wickDownColor: "#ef4444",
        priceLineVisible: true,
        lastValueVisible: true,
      });
      candleSeriesRef.current = series as ISeriesApi<"Candlestick">;
      areaSeriesRef.current   = null;
    } else {
      const series = chart.addSeries(AreaSeries, {
        lineColor:   "#334155",
        lineWidth:   2,
        topColor:    "rgba(51,65,85,0.1)",
        bottomColor: "transparent",
        priceLineVisible: true,
        priceLineColor:   "#1e293b",
        priceLineWidth:   1,
        lastValueVisible: true,
      });
      areaSeriesRef.current   = series as ISeriesApi<"Area">;
      candleSeriesRef.current = null;
    }

    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current        = null;
      areaSeriesRef.current   = null;
      candleSeriesRef.current = null;
    };
  }, [chartType, granularity]);

  // Load history + tick subscription
  useEffect(() => {
    let cancelled = false;
    let unsubTicks: (() => void) | undefined;
    candleBufferRef.current.clear();

    async function init() {
      try {
        const candles = await fetchCandles(symbol, granularity, 300);
        if (cancelled) return;

        if (chartType === "candle" && candleSeriesRef.current) {
          const data: CandlestickData[] = candles.map((c) => ({
            time:  c.time as UTCTimestamp,
            open:  c.open,
            high:  c.high,
            low:   c.low,
            close: c.close,
          }));
          candleSeriesRef.current.setData(data);
          candles.forEach((c) => candleBufferRef.current.set(c.time, c));
        } else if (chartType === "area" && areaSeriesRef.current) {
          const data: LineData[] = candles.map((c) => ({
            time:  c.time as UTCTimestamp,
            value: c.close,
          }));
          areaSeriesRef.current.setData(data);
        }
        chartRef.current?.timeScale().fitContent();
      } catch { }

      unsubTicks = await subscribeTicks(symbol, (price, t) => {
        if (cancelled) return;
        onPrice?.(price);

        // Update Digit History Logic
        const digit = parseInt(price.toFixed(2).slice(-1));
        setDigitHistory(prev => [...prev.slice(-999), digit]);

        if (chartType === "area" && areaSeriesRef.current) {
          areaSeriesRef.current.update({ time: t as UTCTimestamp, value: price });
        } else if (chartType === "candle" && candleSeriesRef.current) {
          const barTime = Math.floor(t / granularity) * granularity;
          const buf = candleBufferRef.current;
          const existing = buf.get(barTime);
          const bar: Candle = existing
            ? { ...existing, high: Math.max(existing.high, price), low: Math.min(existing.low, price), close: price }
            : { time: barTime, open: price, high: price, low: price, close: price };
          buf.set(barTime, bar);
          candleSeriesRef.current.update({
            time:  barTime as UTCTimestamp,
            open:  bar.open,
            high:  bar.high,
            low:   bar.low,
            close: bar.close,
          });
        }
      });
    }

    init();
    return () => {
      cancelled = true;
      unsubTicks?.();
    };
  }, [symbol, granularity, chartType]);

  // Barrier lines
  useEffect(() => {
    const series = areaSeriesRef.current ?? candleSeriesRef.current;
    if (!series) return;
    if (highLineRef.current) { series.removePriceLine(highLineRef.current); highLineRef.current = null; }
    if (lowLineRef.current)  { series.removePriceLine(lowLineRef.current);  lowLineRef.current  = null; }
    if (highBarrier != null && Number.isFinite(highBarrier)) {
      highLineRef.current = series.createPriceLine({
        price: highBarrier, color: "#3b82f6", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "+",
      });
    }
    if (lowBarrier != null && Number.isFinite(lowBarrier)) {
      lowLineRef.current = series.createPriceLine({
        price: lowBarrier, color: "#3b82f6", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "−",
      });
    }
  }, [highBarrier, lowBarrier]);

  // Stats Logic for Dcircles
  const stats = useMemo(() => {
    const counts = new Array(10).fill(0);
    digitHistory.forEach(d => counts[d]++);
    const total = digitHistory.length || 1;
    const pcts = counts.map(c => (c / total) * 100);
    const maxVal = Math.max(...pcts);
    const minVal = Math.min(...pcts);

    return counts.map((count, i) => ({
      digit: i, count, pct: pcts[i].toFixed(1),
      isMost: pcts[i] === maxVal && maxVal > 0,
      isLeast: pcts[i] === minVal && total > 50,
    }));
  }, [digitHistory]);

  const symbolOptions = useMemo(() => {
    if (allSymbols.length === 0)
      return SYNTHETIC_MARKETS.map((m) => ({ symbol: m.symbol, display_name: m.name }));
    const syn  = allSymbols.filter((s) => s.market === "synthetic_index");
    const rest = allSymbols.filter((s) => s.market !== "synthetic_index");
    return [...syn, ...rest];
  }, [allSymbols]);

  return (
    <div className={cn("relative flex flex-col w-full", className)}>
      {/* TOOLBAR */}
      <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
        <Select value={symbol} onValueChange={(v) => onSymbolChange?.(v)}>
          <SelectTrigger className="w-52 h-9 rounded-xl bg-white border-slate-200 font-bold text-slate-700 shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {symbolOptions.map((m) => (
              <SelectItem key={m.symbol} value={m.symbol}>{m.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
          {TIMEFRAMES.slice(0, 4).map((tf) => (
            <button
              key={tf.value}
              type="button"
              onClick={() => setGranularity(tf.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold transition-all",
                granularity === tf.value ? "bg-slate-900 text-white" : "bg-transparent text-slate-500 hover:bg-slate-50",
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
          <button type="button" onClick={() => setChartType("area")} className={cn("px-3 py-1.5 text-xs font-bold transition", chartType === "area" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50")}>Area</button>
          <button type="button" onClick={() => setChartType("candle")} className={cn("px-3 py-1.5 text-xs font-bold transition", chartType === "candle" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50")}>Candle</button>
        </div>

        <span className={cn("ml-auto rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border", STATUS_STYLE[status])}>
          {status}
        </span>
      </div>

      {/* CHART CONTAINER */}
      <div className="relative w-full overflow-hidden bg-white border border-slate-200 rounded-[32px] shadow-sm group">
        <div ref={containerRef} style={{ height }} className="w-full" />

        {/* FLOATING DCIRCLES OVERLAY (Floating inside chart container) */}
        {isDigitTrade && (
          <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none z-20 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-3 sm:gap-5 bg-white/60 backdrop-blur-md border border-white/50 p-4 rounded-[28px] shadow-2xl pointer-events-auto">
              {stats.map((s) => (
                <div key={s.digit} className="flex flex-col items-center group relative">
                  <div className="relative">
                    {/* Circle */}
                    <div className={cn(
                      "size-9 sm:size-11 rounded-full border-2 flex flex-col items-center justify-center transition-all duration-300 shadow-sm",
                      lastDigit === s.digit ? "scale-110 ring-4 ring-slate-100" : "opacity-80 grayscale-[20%]",
                      "bg-white border-slate-200"
                    )}>
                      <span className="text-sm sm:text-base font-black text-slate-800 leading-none">{s.digit}</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 mt-0.5">{s.pct}%</span>
                    </div>

                    {/* Color bar at bottom of circle */}
                    <div className={cn(
                      "absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 sm:w-7 h-1 rounded-full",
                      s.isMost ? "bg-[#4bb4b3]" : s.isLeast ? "bg-[#ff444f]" : "bg-slate-300"
                    )} />
                  </div>

                  {/* ORANGE TRIANGLE INDICATOR (Points to active digit) */}
                  {lastDigit === s.digit && (
                    <div className="absolute -bottom-5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-[#ff444f]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between px-2">
         <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Info className="size-3 text-blue-500" /> Statistical processing: 1000 tick window
         </div>
         <div className="text-[10px] font-black text-slate-300 uppercase">
           ArkTrader Hub Analysis v2.1
         </div>
      </div>
    </div>
  );
}