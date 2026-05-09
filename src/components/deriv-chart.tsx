import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  AreaSeries,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type CandlestickData,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  fetchCandles,
  fetchTicks,
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
import {
  clearBarrierLines,
  renderBarrierLines,
  type BarrierLineRefs,
} from "@/lib/chart-barriers";

type ChartType = "area" | "candle";
type AnalysisTool = "sma" | "ema" | "bollinger" | "highlow";

type Props = {
  symbol: string;
  onSymbolChange?: (s: string) => void;
  onPrice?: (price: number) => void;
  height?: number;
  className?: string;
  entryPrice?: number | null;
  highBarrier?: number | null;
  lowBarrier?: number | null;
  barrierBreached?: boolean;
};

const TIMEFRAMES = [
  { label: "Tick", value: 0 },
  { label: "1m", value: 60 },
  { label: "2m", value: 120 },
  { label: "3m", value: 180 },
  { label: "5m", value: 300 },
  { label: "10m", value: 600 },
  { label: "15m", value: 900 },
  { label: "30m", value: 1800 },
  { label: "1H", value: 3600 },
  { label: "2H", value: 7200 },
  { label: "4H", value: 14400 },
  { label: "8H", value: 28800 },
  { label: "1D", value: 86400 },
];

const ANALYSIS_TOOLS: { label: string; value: AnalysisTool }[] = [
  { label: "SMA", value: "sma" },
  { label: "EMA", value: "ema" },
  { label: "Bands", value: "bollinger" },
  { label: "H/L", value: "highlow" },
];

const STATUS_STYLE: Record<ConnectionStatus, string> = {
  connecting: "bg-yellow-400/20 text-yellow-600",
  connected: "bg-green-500/20 text-green-600",
  reconnecting: "bg-orange-500/20 text-orange-600",
  disconnected: "bg-red-500/20 text-red-600",
};

export function DerivChart({
  symbol,
  onSymbolChange,
  onPrice,
  height = 420,
  className,
  entryPrice,
  highBarrier,
  lowBarrier,
  barrierBreached,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const indicatorSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const highLowLineRefs = useRef<IPriceLine[]>([]);
  const barrierLineRefs = useRef<BarrierLineRefs>({ entry: null, lower: null, upper: null });
  const candleBufferRef = useRef<Map<number, Candle>>(new Map());
  const historyRef = useRef<LineData[]>([]);

  const [granularity, setGranularity] = useState(0);
  const [chartType, setChartType] = useState<ChartType>("area");
  const [analysisTools, setAnalysisTools] = useState<Set<AnalysisTool>>(new Set());
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [allSymbols, setAllSymbols] = useState<
    { symbol: string; display_name: string; market: string }[]
  >([]);
  const analysisToolsRef = useRef(analysisTools);

  useEffect(() => {
    analysisToolsRef.current = analysisTools;
  }, [analysisTools]);

  const clearAnalysisOverlays = useCallback(() => {
    const chart = chartRef.current;
    indicatorSeriesRef.current.forEach((series) => {
      try {
        chart?.removeSeries(series);
      } catch {
        /* ignore */
      }
    });
    indicatorSeriesRef.current = [];
    const baseSeries = areaSeriesRef.current ?? candleSeriesRef.current;
    highLowLineRefs.current.forEach((line) => {
      try {
        baseSeries?.removePriceLine(line);
      } catch {
        /* ignore */
      }
    });
    highLowLineRefs.current = [];
  }, []);

  const updateAnalysisOverlays = useCallback(() => {
    const chart = chartRef.current;
    const data = historyRef.current;
    const baseSeries = areaSeriesRef.current ?? candleSeriesRef.current;
    const tools = analysisToolsRef.current;
    if (!chart || !baseSeries) return;
    clearAnalysisOverlays();
    if (!data.length || tools.size === 0) return;

    if (tools.has("sma")) {
      const series = chart.addSeries(LineSeries, {
        color: "#2563eb",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData(movingAverage(data, 20));
      indicatorSeriesRef.current.push(series);
    }
    if (tools.has("ema")) {
      const series = chart.addSeries(LineSeries, {
        color: "#9333ea",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData(exponentialAverage(data, 20));
      indicatorSeriesRef.current.push(series);
    }
    if (tools.has("bollinger")) {
      const [upper, lower] = bollingerBands(data, 20);
      const upperSeries = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const lowerSeries = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      upperSeries.setData(upper);
      lowerSeries.setData(lower);
      indicatorSeriesRef.current.push(upperSeries, lowerSeries);
    }
    if (tools.has("highlow")) {
      const values = data.map((point) => point.value);
      const high = Math.max(...values);
      const low = Math.min(...values);
      highLowLineRefs.current = [
        baseSeries.createPriceLine({
          price: high,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "High",
        }),
        baseSeries.createPriceLine({
          price: low,
          color: "#22c55e",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Low",
        }),
      ];
    }
  }, [clearAnalysisOverlays]);

  useEffect(() => {
    getActiveSymbols()
      .then((list) => {
        if (list?.length) setAllSymbols(list);
      })
      .catch(() => {
        setAllSymbols(
          SYNTHETIC_MARKETS.map((m) => ({
            symbol: m.symbol,
            display_name: m.name,
            market: "synthetic_index",
          })),
        );
      });
  }, []);

  useEffect(() => {
    const off = onStatus(setStatus);
    return () => {
      off();
    };
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
      indicatorSeriesRef.current = [];
      highLowLineRefs.current = [];
      barrierLineRefs.current = { entry: null, lower: null, upper: null };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType]);

  // Load history + tick subscription on symbol/granularity/chartType change.
  useEffect(() => {
    let cancelled = false;
    let unsubTicks: (() => void) | undefined;
    candleBufferRef.current.clear();
    historyRef.current = [];

    async function init() {
      try {
        if (chartType === "area") {
          const ticks =
            granularity === 0
              ? await fetchTicks(symbol, 500)
              : (await fetchCandles(symbol, granularity, 300)).map((c) => ({
                  time: c.time,
                  value: c.close,
                }));
          if (cancelled) return;
          const data: LineData[] = ticks.map((point) => ({
            time: point.time as UTCTimestamp,
            value: point.value,
          }));
          historyRef.current = data;
          areaSeriesRef.current?.setData(data);
        } else if (candleSeriesRef.current) {
          const candleGranularity = granularity || 60;
          const candles = await fetchCandles(symbol, candleGranularity, 300);
          if (cancelled) return;
          const data: CandlestickData[] = candles.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));
          candleSeriesRef.current.setData(data);
          candles.forEach((c) => candleBufferRef.current.set(c.time, c));
          historyRef.current = candles.map((c) => ({
            time: c.time as UTCTimestamp,
            value: c.close,
          }));
        }
        updateAnalysisOverlays();
        chartRef.current?.timeScale().fitContent();
      } catch {
        /* network/timeout handled by status badge */
      }

      unsubTicks = await subscribeTicks(symbol, (price, t) => {
        if (cancelled) return;
        onPrice?.(price);
        const tickPoint = { time: t as UTCTimestamp, value: price };

        if ((chartType === "area" || granularity === 0) && areaSeriesRef.current) {
          areaSeriesRef.current.update(tickPoint);
          historyRef.current = [...historyRef.current.slice(-499), tickPoint];
        } else if (chartType === "candle" && candleSeriesRef.current) {
          const candleGranularity = granularity || 60;
          const barTime = Math.floor(t / candleGranularity) * candleGranularity;
          const buf = candleBufferRef.current;
          const existing = buf.get(barTime);
          const bar: Candle = existing
            ? {
                ...existing,
                high: Math.max(existing.high, price),
                low: Math.min(existing.low, price),
                close: price,
              }
            : { time: barTime, open: price, high: price, low: price, close: price };
          buf.set(barTime, bar);
          candleSeriesRef.current.update({
            time: barTime as UTCTimestamp,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
          });
          historyRef.current = [
            ...historyRef.current
              .filter((point) => point.time !== (barTime as UTCTimestamp))
              .slice(-499),
            { time: barTime as UTCTimestamp, value: bar.close },
          ];
        }
        updateAnalysisOverlays();
      });
    }

    init();
    return () => {
      cancelled = true;
      unsubTicks?.();
    };
  }, [symbol, granularity, chartType, onPrice, updateAnalysisOverlays]);

  useEffect(() => {
    updateAnalysisOverlays();
  }, [analysisTools, chartType, updateAnalysisOverlays]);

  // Barrier lines.
  useEffect(() => {
    const series = areaSeriesRef.current ?? candleSeriesRef.current;
    if (!series) return;
    clearBarrierLines(series, barrierLineRefs.current);
    renderBarrierLines(series, barrierLineRefs.current, {
      entryPrice,
      lowerBarrier: lowBarrier,
      upperBarrier: highBarrier,
      breached: barrierBreached,
    });
  }, [entryPrice, highBarrier, lowBarrier, barrierBreached]);

  function toggleAnalysisTool(tool: AnalysisTool) {
    setAnalysisTools((current) => {
      const next = new Set(current);
      if (next.has(tool)) next.delete(tool);
      else next.add(tool);
      return next;
    });
  }

  const symbolOptions = useMemo(() => {
    if (allSymbols.length === 0)
      return SYNTHETIC_MARKETS.map((m) => ({ symbol: m.symbol, display_name: m.name }));
    const syn = allSymbols.filter((s) => s.market === "synthetic_index");
    const rest = allSymbols.filter((s) => s.market !== "synthetic_index");
    return [...syn, ...rest];
  }, [allSymbols]);

  return (
    <div className={cn("min-w-0", className)}>
      {/* Toolbar */}
      <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
        {/* Symbol selector */}
        <Select value={symbol} onValueChange={(v) => onSymbolChange?.(v)}>
          <SelectTrigger className="w-full min-w-0 glass-card text-xs sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {symbolOptions.map((m) => (
              <SelectItem key={m.symbol} value={m.symbol}>
                {m.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Timeframe buttons */}
        <div className="flex max-w-full min-w-0 overflow-x-auto rounded-md border border-glass-border">
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
        <div className="flex shrink-0 overflow-hidden rounded-md border border-glass-border">
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
            onClick={() => {
              if (granularity === 0) setGranularity(60);
              setChartType("candle");
            }}
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

        <div className="flex max-w-full overflow-x-auto rounded-md border border-glass-border">
          {ANALYSIS_TOOLS.map((tool) => (
            <button
              key={tool.value}
              type="button"
              onClick={() => toggleAnalysisTool(tool.value)}
              title={`${tool.label} analysis`}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium transition-colors",
                analysisTools.has(tool.value)
                  ? "bg-[#ff444f] text-white"
                  : "bg-transparent text-muted-foreground hover:bg-foreground/5",
              )}
            >
              {tool.label}
            </button>
          ))}
        </div>

        {/* Connection status */}
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider sm:ml-auto",
            STATUS_STYLE[status],
          )}
        >
          ● {status}
        </span>
      </div>

      {/* Chart canvas */}
      <div
        ref={containerRef}
        style={{ height }}
        className="w-full max-w-full overflow-hidden rounded-lg border border-glass-border bg-foreground/[0.02]"
      />
    </div>
  );
}

function movingAverage(data: LineData[], period: number): LineData[] {
  return data.map((point, index) => {
    const window = data.slice(Math.max(0, index - period + 1), index + 1);
    const value = window.reduce((sum, item) => sum + item.value, 0) / window.length;
    return { time: point.time, value };
  });
}

function exponentialAverage(data: LineData[], period: number): LineData[] {
  const k = 2 / (period + 1);
  let previous = data[0]?.value ?? 0;
  return data.map((point, index) => {
    const value = index === 0 ? point.value : point.value * k + previous * (1 - k);
    previous = value;
    return { time: point.time, value };
  });
}

function bollingerBands(data: LineData[], period: number): [LineData[], LineData[]] {
  const upper: LineData[] = [];
  const lower: LineData[] = [];
  data.forEach((point, index) => {
    const window = data.slice(Math.max(0, index - period + 1), index + 1);
    const mean = window.reduce((sum, item) => sum + item.value, 0) / window.length;
    const variance =
      window.reduce((sum, item) => sum + Math.pow(item.value - mean, 2), 0) / window.length;
    const deviation = Math.sqrt(variance);
    upper.push({ time: point.time, value: mean + deviation * 2 });
    lower.push({ time: point.time, value: mean - deviation * 2 });
  });
  return [upper, lower];
}
