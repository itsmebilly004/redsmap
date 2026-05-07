import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  AreaSeries,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
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
} from "@/lib/deriv";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart2, CandlestickChart, LineChart, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ChartType = "area" | "candlestick" | "line";

type Props = {
  symbol: string;
  onSymbolChange?: (s: string) => void;
  onPrice?: (price: number) => void;
  height?: number;
  className?: string;
  highBarrier?: number | null;
  lowBarrier?: number | null;
  isAccumulator?: boolean;
};

const CANDLE_TIMEFRAMES = [
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

// Map Deriv market names to display categories
const MARKET_LABEL: Record<string, string> = {
  synthetic_index: "Synthetics",
  forex: "Forex",
  cryptocurrency: "Crypto",
  indices: "Indices",
  commodities: "Commodities",
  energy: "Energy",
  metals: "Metals",
  stock_index: "Stock Indices",
};

const CHART_TYPE_ICONS: Record<ChartType, React.ReactNode> = {
  area: <BarChart2 className="size-4" />,
  candlestick: <CandlestickChart className="size-4" />,
  line: <LineChart className="size-4" />,
};

const CHART_TYPE_LABELS: Record<ChartType, string> = {
  area: "Area",
  candlestick: "Candles",
  line: "Line",
};

export function DerivChart({
  symbol,
  onSymbolChange,
  onPrice,
  height = 420,
  className,
  highBarrier,
  lowBarrier,
  isAccumulator = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const highLineRef = useRef<IPriceLine | null>(null);
  const lowLineRef = useRef<IPriceLine | null>(null);

  const [chartType, setChartType] = useState<ChartType>("area");
  const [granularity, setGranularity] = useState(60);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [allSymbols, setAllSymbols] =
    useState<{ symbol: string; display_name: string; market: string }[]>([]);

  // Accumulator always uses tick (area) mode
  const effectiveChartType: ChartType = isAccumulator ? "area" : chartType;
  const useTicks = isAccumulator || granularity === 0;

  // Load all active symbols from Deriv, fall back to bundled list
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
    return () => { off(); };
  }, []);

  // Build and destroy chart instance
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
        secondsVisible: granularity <= 300,
      },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;

    // Add the correct series type
    addSeries(chart, effectiveChartType);

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [effectiveChartType]);

  function addSeries(chart: IChartApi, type: ChartType) {
    // Remove old series if any
    if (seriesRef.current) {
      try { chart.removeSeries(seriesRef.current); } catch { /* ignore */ }
      seriesRef.current = null;
    }

    if (type === "candlestick") {
      seriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      });
    } else if (type === "line") {
      seriesRef.current = chart.addSeries(LineSeries, {
        color: "#1f2937",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
    } else {
      // area (default)
      seriesRef.current = chart.addSeries(AreaSeries, {
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
    }
  }

  // When chart type changes, swap series
  useEffect(() => {
    if (!chartRef.current) return;
    addSeries(chartRef.current, effectiveChartType);
    // Re-load data with new series
  }, [effectiveChartType]);

  // Load history + subscribe to live ticks
  useEffect(() => {
    let cancelled = false;
    let unsubTicks: (() => void) | undefined;

    async function init() {
      const series = seriesRef.current;
      if (!series) return;
      series.setData([]);

      if (useTicks) {
        // Tick mode: load recent ticks as area/line data
        try {
          const ticks = await fetchTicks(symbol, 500);
          if (cancelled || !seriesRef.current) return;
          const data = ticks.map((t) => ({
            time: t.time as UTCTimestamp,
            value: t.price,
          }));
          seriesRef.current.setData(data);
          chartRef.current?.timeScale().scrollToRealTime();
        } catch {
          /* ignore */
        }
      } else {
        // Candle mode
        try {
          const candles = await fetchCandles(symbol, granularity, 500);
          if (cancelled || !seriesRef.current) return;
          if (effectiveChartType === "candlestick") {
            const data = candles.map((c) => ({
              time: c.time as UTCTimestamp,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }));
            seriesRef.current.setData(data);
          } else {
            const data = candles.map((c) => ({
              time: c.time as UTCTimestamp,
              value: c.close,
            }));
            seriesRef.current.setData(data);
          }
          chartRef.current?.timeScale().fitContent();
        } catch {
          /* ignore */
        }
      }

      unsubTicks = await subscribeTicks(symbol, (price, t) => {
        onPrice?.(price);
        const s = seriesRef.current;
        if (!s) return;
        if (effectiveChartType === "candlestick" && !useTicks) {
          // For candlestick mode, update the close of the last candle
          // Lightweight-charts handles partial candle updates via update()
          s.update({ time: t as UTCTimestamp, open: price, high: price, low: price, close: price });
        } else {
          s.update({ time: t as UTCTimestamp, value: price });
        }
        if (useTicks) {
          chartRef.current?.timeScale().scrollToRealTime();
        }
      });
    }

    init();
    return () => {
      cancelled = true;
      unsubTicks?.();
    };
  }, [symbol, granularity, effectiveChartType, useTicks, onPrice]);

  // Barrier lines for accumulator
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (highLineRef.current) {
      try { series.removePriceLine(highLineRef.current); } catch { /* ignore */ }
      highLineRef.current = null;
    }
    if (lowLineRef.current) {
      try { series.removePriceLine(lowLineRef.current); } catch { /* ignore */ }
      lowLineRef.current = null;
    }

    if (highBarrier != null && Number.isFinite(highBarrier)) {
      highLineRef.current = series.createPriceLine({
        price: highBarrier,
        color: "#00C853",
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        title: "▲ High",
      });
    }
    if (lowBarrier != null && Number.isFinite(lowBarrier)) {
      lowLineRef.current = series.createPriceLine({
        price: lowBarrier,
        color: "#FF1744",
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        title: "▼ Low",
      });
    }
  }, [highBarrier, lowBarrier]);

  // Group symbols by market category
  const groupedSymbols = useMemo(() => {
    const source =
      allSymbols.length === 0
        ? SYNTHETIC_MARKETS.map((m) => ({
            symbol: m.symbol,
            display_name: m.name,
            market: "synthetic_index",
          }))
        : allSymbols;

    const groups: Record<string, { symbol: string; display_name: string }[]> = {};
    // Always put synthetics first
    const order = ["synthetic_index", "forex", "cryptocurrency", "indices", "commodities", "metals", "energy"];
    for (const s of source) {
      if (!groups[s.market]) groups[s.market] = [];
      groups[s.market].push({ symbol: s.symbol, display_name: s.display_name });
    }
    const orderedGroups: { market: string; items: { symbol: string; display_name: string }[] }[] = [];
    for (const m of order) {
      if (groups[m]) orderedGroups.push({ market: m, items: groups[m] });
    }
    // Append any remaining markets not in the order list
    for (const m of Object.keys(groups)) {
      if (!order.includes(m)) orderedGroups.push({ market: m, items: groups[m] });
    }
    return orderedGroups;
  }, [allSymbols]);

  return (
    <div className={className}>
      {/* Chart controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Symbol selector — grouped by market */}
        <Select value={symbol} onValueChange={(v) => onSymbolChange?.(v)}>
          <SelectTrigger className="w-48 sm:w-64 glass-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-96 overflow-y-auto">
            {groupedSymbols.map(({ market, items }) => (
              <SelectGroup key={market}>
                <SelectLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {MARKET_LABEL[market] ?? market}
                </SelectLabel>
                {items.map((m) => (
                  <SelectItem key={m.symbol} value={m.symbol}>
                    {m.display_name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {/* Chart type selector */}
        {!isAccumulator && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-md border border-glass-border bg-background px-2 py-1.5 text-xs hover:bg-foreground/5">
                {CHART_TYPE_ICONS[chartType]}
                <span className="hidden sm:inline">{CHART_TYPE_LABELS[chartType]}</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(["area", "candlestick", "line"] as ChartType[]).map((t) => (
                <DropdownMenuItem
                  key={t}
                  onClick={() => setChartType(t)}
                  className={cn("gap-2", chartType === t && "bg-muted")}
                >
                  {CHART_TYPE_ICONS[t]}
                  {CHART_TYPE_LABELS[t]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Timeframe buttons */}
        {!isAccumulator && (
          <div className="flex overflow-hidden rounded-md border border-glass-border">
            {CANDLE_TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                type="button"
                onClick={() => setGranularity(tf.value)}
                className={[
                  "px-2.5 py-1.5 text-xs font-medium transition-colors",
                  granularity === tf.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-foreground/5",
                ].join(" ")}
              >
                {tf.label}
              </button>
            ))}
          </div>
        )}

        {isAccumulator && (
          <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Tick Chart — Accumulator Mode
          </span>
        )}

        <span
          className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLE[status]}`}
        >
          ● {status}
        </span>
      </div>

      {/* Barrier legend (accumulator only) */}
      {isAccumulator && highBarrier != null && lowBarrier != null && (
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-glass-border bg-foreground/[0.02] px-3 py-1.5 text-xs">
          <span className="flex items-center gap-1.5 font-mono font-semibold text-emerald-600">
            <span className="inline-block h-0.5 w-4 bg-emerald-500" />
            High {highBarrier.toFixed(4)}
          </span>
          <span className="flex items-center gap-1.5 font-mono font-semibold text-red-500">
            <span className="inline-block h-0.5 w-4 bg-red-500" />
            Low {lowBarrier.toFixed(4)}
          </span>
          <span className="text-muted-foreground">
            Zone ±{(((highBarrier - lowBarrier) / 2 / ((highBarrier + lowBarrier) / 2)) * 100).toFixed(4)}%
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        style={{ height }}
        className="w-full overflow-hidden rounded-lg border border-glass-border bg-foreground/[0.02]"
      />
    </div>
  );
}

