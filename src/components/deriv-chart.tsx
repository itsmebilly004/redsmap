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
import { ChevronDown, Info } from "lucide-react";

type ChartType = "area" | "candle";

type Props = {
  symbol: string;
  category?: string; // Toggles Dcircles (e.g. over_under, even_odd, matches_differs)
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

  // Digit distribution state
  const [digitHistory, setDigitHistory] = useState<number[]>([]);
  const lastDigit = digitHistory[digitHistory.length - 1];

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

  // Build chart once; rebuild when chart type changes.
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
        vertLines: { color: "rgba(120,120,140,0.08)" },
        horzLines: { color: "rgba(120,120,140,0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(120,120,140,0.15)" },
      timeScale: {
        borderColor: "rgba(120,120,140,0.15)",
        timeVisible: true,
        secondsVisible: granularity < 60,
      },
      crosshair: { mode: 1 },
    });

    if (chartType === "candle") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor:   "#22c55e",
        downColor: "#ef4444",
        borderUpColor:   "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor:   "#22c55e",
        wickDownColor: "#ef4444",
        priceLineVisible: true,
        lastValueVisible: true,
      });
      candleSeriesRef.current = series as ISeriesApi<"Candlestick">;
      areaSeriesRef.current   = null;
    } else {
      const series = chart.addSeries(AreaSeries, {
        lineColor:   "#1f2937",
        lineWidth:   2,
        topColor:    "rgba(31,41,55,0.18)",
        bottomColor: "rgba(31,41,55,0.0)",
        priceLineVisible: true,
        priceLineColor:   "#111827",
        priceLineWidth:   1,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius:  4,
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

  // Load history + tick subscription on symbol/granularity/chartType change.
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

        // Update Digit History
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

  // Barrier lines.
  useEffect(() => {
    const series = areaSeriesRef.current ?? candleSeriesRef.current;
    if (!series) return;
    if (highLineRef.current) { series.removePriceLine(highLineRef.current); highLineRef.current = null; }
    if (lowLineRef.current)  { series.removePriceLine(lowLineRef.current);  lowLineRef.current  = null; }
    if (highBarrier != null && Number.isFinite(highBarrier)) {
      highLineRef.current = series.createPriceLine({
        price: highBarrier, color: "#2196f3", lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: "+",
      });
    }
    if (lowBarrier != null && Number.isFinite(lowBarrier)) {
      lowLineRef.current = series.createPriceLine({
        price: lowBarrier, color: "#2196f3", lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: "−",
      });
    }
  }, [highBarrier, lowBarrier]);

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
      {/* TOOLBAR (Original components restored) */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Select value={symbol} onValueChange={(v) => onSymbolChange?.(v)}>
          <SelectTrigger className="w-52 glass-card text-xs sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {symbolOptions.map((m) => (
              <SelectItem key={m.symbol} value={m.symbol}>{m.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex overflow-hidden rounded-md border border-glass-border">
          {TIMEFRAMES.slice(0, 4).map((tf) => (
            <button
              key={tf.value}
              type="button"
              onClick={() => setGranularity(tf.value)}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium transition-colors",
                granularity === tf.value ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-foreground/5",
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className="flex overflow-hidden rounded-md border border-glass-border">
          <button type="button" onClick={() => setChartType("area")} className={cn("px-2.5 py-1.5 text-xs font-medium transition-colors", chartType === "area" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground")}>Area</button>
          <button type="button" onClick={() => setChartType("candle")} className={cn("px-2.5 py-1.5 text-xs font-medium transition-colors", chartType === "candle" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground")}>Candle</button>
        </div>

        <span className={cn("ml-auto rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider", STATUS_STYLE[status])}>
          ● {status}
        </span>
      </div>

      {/* CHART CANVAS */}
      <div className="relative w-full overflow-hidden bg-white border border-slate-200 rounded-[32px] shadow-sm group">
        <div ref={containerRef} style={{ height }} className="w-full" />

        {/* FLOATING DCIRCLES (Added accurately now) */}
        {isDigitTrade && (
          <div className="absolute bottom-6 left-0 right-0 px-6 pointer-events-none z-10 animate-in fade-in slide-in-from-bottom-4">
            <div className="max-w-4xl mx-auto bg-white/70 backdrop-blur-md border border-white/40 p-5 rounded-[24px] shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">
                  Last 1000 Ticks <span className="opacity-20">|</span> Digit Distribution
                </span>
              </div>

              <div className="flex items-end justify-between gap-1">
                {stats.map((s) => (
                  <div key={s.digit} className="flex flex-col items-center flex-1">
                    <div className="h-6 flex items-center justify-center mb-1">
                      {lastDigit === s.digit && (
                        <div className="w-4 h-4 bg-[#3b82f6] rounded-sm rotate-45 flex items-center justify-center shadow-lg animate-bounce">
                           <div className="size-1 bg-white rounded-full" />
                        </div>
                      )}
                    </div>
                    <div className={cn(
                      "size-10 sm:size-11 rounded-full border-2 flex items-center justify-center text-sm sm:text-base font-black transition-all",
                      lastDigit === s.digit ? "scale-110 z-20 shadow-blue-200" : "opacity-90",
                      DIGIT_CONFIG[s.digit]
                    )}>
                      {s.digit}
                    </div>
                    <div className="mt-2 text-center leading-none">
                      <div className="text-[11px] font-black text-slate-800">{s.pct}%</div>
                      <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase">
                        {s.isMost ? 'most' : s.isLeast ? 'least' : s.count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
        <Info className="size-3 text-blue-500" /> 
        current digit: <span className="text-slate-900 ml-1">{lastDigit ?? "—"}</span>
      </div>
    </div>
  );
}