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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType]);

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
          // Seed buffer with last candles for tick aggregation
          candles.forEach((c) => candleBufferRef.current.set(c.time, c));
        } else if (chartType === "area" && areaSeriesRef.current) {
          const data: LineData[] = candles.map((c) => ({
            time:  c.time as UTCTimestamp,
            value: c.close,
          }));
          areaSeriesRef.current.setData(data);
        }
        chartRef.current?.timeScale().fitContent();
      } catch {
        /* network/timeout handled by status badge */
      }

      unsubTicks = await subscribeTicks(symbol, (price, t) => {
        if (cancelled) return;
        onPrice?.(price);

        if (chartType === "area" && areaSeriesRef.current) {
          areaSeriesRef.current.update({ time: t as UTCTimestamp, value: price });
        } else if (chartType === "candle" && candleSeriesRef.current) {
          // Aggregate ticks into candles using the current granularity
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
  }, [symbol, granularity, chartType, onPrice]);

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

  const symbolOptions = useMemo(() => {
    if (allSymbols.length === 0)
      return SYNTHETIC_MARKETS.map((m) => ({ symbol: m.symbol, display_name: m.name }));
    const syn  = allSymbols.filter((s) => s.market === "synthetic_index");
    const rest = allSymbols.filter((s) => s.market !== "synthetic_index");
    return [...syn, ...rest];
  }, [allSymbols]);

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {/* Symbol selector */}
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

        {/* Timeframe buttons */}
        <div className="flex overflow-hidden rounded-md border border-glass-border">
          {TIMEFRAMES.map((tf) => (
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

        {/* Chart type toggle */}
        <div className="flex overflow-hidden rounded-md border border-glass-border">
          <button
            type="button"
            onClick={() => setChartType("area")}
            title="Line / Area"
            className={cn(
              "px-2.5 py-1.5 text-xs font-medium transition-colors",
              chartType === "area"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:bg-foreground/5",
            )}
          >
            Area
          </button>
          <button
            type="button"
            onClick={() => setChartType("candle")}
            title="Candlestick"
            className={cn(
              "px-2.5 py-1.5 text-xs font-medium transition-colors",
              chartType === "candle"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:bg-foreground/5",
            )}
          >
            Candle
          </button>
        </div>

        {/* Connection status */}
        <span className={cn("ml-auto rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider", STATUS_STYLE[status])}>
          ● {status}
        </span>
      </div>

      {/* Chart canvas */}
      <div
        ref={containerRef}
        style={{ height }}
        className="w-full overflow-hidden rounded-lg border border-glass-border bg-foreground/[0.02]"
      />
    </div>
  );
}
