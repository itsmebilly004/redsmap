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
  category?: string; // New prop to determine if we show Dcircles
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
  { label: "15m", value: 900 },
  { label: "1H", value: 3600 },
  { label: "4H", value: 14400 },
  { label: "1D", value: 86400 },
];

const STATUS_STYLE: Record<ConnectionStatus, string> = {
  connecting: "bg-yellow-400/20 text-yellow-600",
  connected: "bg-green-500/20 text-green-600",
  reconnecting: "bg-orange-500/20 text-orange-600",
  disconnected: "bg-red-500/20 text-red-600",
};

// Configuration for digit colors as seen in Deriv
const DIGIT_COLORS: Record<number, string> = {
  1: "bg-[#ffad00] border-[#ffad00] text-white",
  2: "bg-[#f44336] border-[#f44336] text-white",
  4: "bg-[#4caf50] border-[#4caf50] text-white",
  5: "bg-[#2196f3] border-[#2196f3] text-white",
  6: "bg-[#ff5722] border-[#ff5722] text-white",
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
  const candleBufferRef = useRef<Map<number, Candle>>(new Map());

  const [granularity, setGranularity] = useState(60);
  const [chartType, setChartType] = useState<ChartType>("area");
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [allSymbols, setAllSymbols] = useState<{ symbol: string; display_name: string; market: string }[]>([]);
  
  // Digit distribution state
  const [digits, setDigits] = useState<number[]>([]);

  const isDigitCategory = useMemo(() => {
    const digitTypes = ["over_under", "even_odd", "matches_differs"];
    return digitTypes.includes(category || "");
  }, [category]);

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
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
        priceLineVisible: true,
        lastValueVisible: true,
      });
      candleSeriesRef.current = series as ISeriesApi<"Candlestick">;
      areaSeriesRef.current = null;
    } else {
      const series = chart.addSeries(AreaSeries, {
        lineColor: "#1f2937",
        lineWidth: 2,
        topColor: "rgba(31,41,55,0.18)",
        bottomColor: "rgba(31,41,55,0.0)",
        priceLineVisible: true,
        priceLineColor: "#111827",
        priceLineWidth: 1,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
      areaSeriesRef.current = series as ISeriesApi<"Area">;
      candleSeriesRef.current = null;
    }

    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      areaSeriesRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [chartType, granularity]);

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
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));
          candleSeriesRef.current.setData(data);
          candles.forEach((c) => candleBufferRef.current.set(c.time, c));
        } else if (chartType === "area" && areaSeriesRef.current) {
          const data: LineData[] = candles.map((c) => ({
            time: c.time as UTCTimestamp,
            value: c.close,
          }));
          areaSeriesRef.current.setData(data);
        }
        chartRef.current?.timeScale().fitContent();
      } catch { /* error handled by status */ }

      unsubTicks = await subscribeTicks(symbol, (price, t) => {
        if (cancelled) return;
        onPrice?.(price);

        // Update Digits (Last 1000)
        const lastDigit = parseInt(price.toFixed(2).slice(-1));
        setDigits(prev => [...prev.slice(-999), lastDigit]);

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
            time: barTime as UTCTimestamp,
            open: bar.open,
            high: bar.high,
            low: bar.low,
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
  }, [symbol, granularity, chartType, onPrice]);

  useEffect(() => {
    const series = areaSeriesRef.current ?? candleSeriesRef.current;
    if (!series) return;
    if (highLineRef.current) { series.removePriceLine(highLineRef.current); highLineRef.current = null; }
    if (lowLineRef.current) { series.removePriceLine(lowLineRef.current); lowLineRef.current = null; }
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
    digits.forEach(d => counts[d]++);
    const total = digits.length || 1;
    const pcts = counts.map(c => (c / total) * 100);
    const max = Math.max(...pcts);
    const min = Math.min(...pcts);

    return Array.from({ length: 10 }, (_, i) => ({
      digit: i,
      count: counts[i],
      percentage: pcts[i].toFixed(1),
      isMost: pcts[i] === max && max > 0,
      isLeast: pcts[i] === min && digits.length > 20
    }));
  }, [digits]);

  const symbolOptions = useMemo(() => {
    if (allSymbols.length === 0)
      return SYNTHETIC_MARKETS.map((m) => ({ symbol: m.symbol, display_name: m.name }));
    const syn = allSymbols.filter((s) => s.market === "synthetic_index");
    const rest = allSymbols.filter((s) => s.market !== "synthetic_index");
    return [...syn, ...rest];
  }, [allSymbols]);

  return (
    <div className={className}>
      {/* Toolbar */}
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
                granularity === tf.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-foreground/5",
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <span className={cn("ml-auto rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider", STATUS_STYLE[status])}>
          ● {status}
        </span>
      </div>

      {/* Chart canvas */}
      <div
        ref={containerRef}
        style={{ height }}
        className="w-full overflow-hidden rounded-lg border border-glass-border bg-foreground/[0.02] relative"
      />

      {/* Dcircles: Digit Distribution Panel */}
      {isDigitCategory && (
        <div className="mt-4 p-4 rounded-xl border border-glass-border bg-card/30 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-foreground/80">Last 1000 ticks — digit distribution</h4>
          </div>
          
          <div className="flex justify-between items-end gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {stats.map((item) => (
              <div key={item.digit} className="flex flex-col items-center min-w-[40px]">
                {/* Current Digit Indicator */}
                <div className="h-5 flex items-center justify-center">
                  {digits[digits.length - 1] === item.digit && (
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-blue-500 animate-bounce" />
                  )}
                </div>

                {/* Digit Circle */}
                <div className={cn(
                  "size-10 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-300",
                  DIGIT_COLORS[item.digit] || "bg-white/5 border-slate-700 text-foreground/70",
                  digits[digits.length - 1] === item.digit && "ring-4 ring-blue-500/20 scale-110"
                )}>
                  {item.digit}
                </div>

                {/* Stats */}
                <div className="mt-2 text-center">
                  <div className="text-[10px] font-bold text-foreground/90">{item.count}</div>
                  <div className="text-[10px] text-muted-foreground">{item.percentage}%</div>
                  
                  {/* Most/Least Labels */}
                  <div className="h-4 flex items-center justify-center mt-0.5">
                    {item.isMost && (
                      <span className="text-[9px] font-bold text-blue-400 flex items-center gap-0.5">
                        <span className="text-[12px]">↑</span> most
                      </span>
                    )}
                    {item.isLeast && (
                      <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
                        <span className="text-[12px]">↓</span> least
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-2 text-[11px] text-muted-foreground border-t border-glass-border/50 pt-2">
            current digit: <span className="font-bold text-foreground">{digits[digits.length - 1] ?? '—'}</span>
          </div>
        </div>
      )}
    </div>
  );
}