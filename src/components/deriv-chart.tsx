import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const TIMEFRAMES = [
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
  { label: "15m", value: 900 },
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
  highBarrier,
  lowBarrier,
  isAccumulator = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const highLineRef = useRef<IPriceLine | null>(null);
  const lowLineRef = useRef<IPriceLine | null>(null);
  const [granularity, setGranularity] = useState(60);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [allSymbols, setAllSymbols] =
    useState<{ symbol: string; display_name: string; market: string }[]>([]);

  // Load all symbols (fall back to bundled list if API fails).
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

  // Status badge.
  useEffect(() => {
    const off = onStatus(setStatus);
    return () => off();
  }, []);

  // Build chart once.
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
        secondsVisible: true,
      },
      crosshair: { mode: 1 },
    });
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
    chartRef.current = chart;
    seriesRef.current = series as ISeriesApi<"Area">;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Load history + subscribe ticks. In accumulator mode load recent ticks
  // instead of candles so the chart zooms in tight around the current price,
  // making the ±barrier zone visually prominent (same as deriv.com).
  useEffect(() => {
    let cancelled = false;
    let unsubTicks: (() => void) | undefined;

    async function init() {
      if (!seriesRef.current) return;
      seriesRef.current.setData([]);

      if (isAccumulator) {
        try {
          const ticks = await fetchTicks(symbol, 300);
          if (cancelled || !seriesRef.current) return;
          const data: LineData[] = ticks.map((t) => ({
            time: t.time as UTCTimestamp,
            value: t.price,
          }));
          seriesRef.current.setData(data);
          chartRef.current?.timeScale().scrollToRealTime();
        } catch {
          /* network error — status badge will reflect */
        }
      } else {
        try {
          const candles = await fetchCandles(symbol, granularity, 300);
          if (cancelled || !seriesRef.current) return;
          const data: LineData[] = candles.map((c) => ({
            time: c.time as UTCTimestamp,
            value: c.close,
          }));
          seriesRef.current.setData(data);
          chartRef.current?.timeScale().fitContent();
        } catch {
          /* ignore */
        }
      }

      unsubTicks = await subscribeTicks(symbol, (price, t) => {
        onPrice?.(price);
        const series = seriesRef.current;
        if (!series) return;
        series.update({ time: t as UTCTimestamp, value: price });
        if (isAccumulator) {
          chartRef.current?.timeScale().scrollToRealTime();
        }
      });
    }

    init();
    return () => {
      cancelled = true;
      unsubTicks?.();
    };
  }, [symbol, granularity, onPrice, isAccumulator]);

  // Manage accumulator barrier lines.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (highLineRef.current) {
      series.removePriceLine(highLineRef.current);
      highLineRef.current = null;
    }
    if (lowLineRef.current) {
      series.removePriceLine(lowLineRef.current);
      lowLineRef.current = null;
    }

    if (highBarrier != null && Number.isFinite(highBarrier)) {
      highLineRef.current = series.createPriceLine({
        price: highBarrier,
        color: "#00C853",
        lineWidth: 2,
        lineStyle: 1, // dashed
        axisLabelVisible: true,
        title: "▲ High",
      });
    }
    if (lowBarrier != null && Number.isFinite(lowBarrier)) {
      lowLineRef.current = series.createPriceLine({
        price: lowBarrier,
        color: "#FF1744",
        lineWidth: 2,
        lineStyle: 1, // dashed
        axisLabelVisible: true,
        title: "▼ Low",
      });
    }
  }, [highBarrier, lowBarrier]);

  const symbolOptions = useMemo(() => {
    if (allSymbols.length === 0)
      return SYNTHETIC_MARKETS.map((m) => ({
        symbol: m.symbol,
        display_name: m.name,
      }));
    const syn = allSymbols.filter((s) => s.market === "synthetic_index");
    const rest = allSymbols.filter((s) => s.market !== "synthetic_index");
    return [...syn, ...rest];
  }, [allSymbols]);

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={symbol} onValueChange={(v) => onSymbolChange?.(v)}>
          <SelectTrigger className="w-48 sm:w-64 glass-card">
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

        {!isAccumulator && (
          <div className="flex overflow-hidden rounded-md border border-glass-border">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                type="button"
                onClick={() => setGranularity(tf.value)}
                className={[
                  "px-3 py-1.5 text-xs font-medium transition-colors",
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

      {/* Barrier legend shown only when barriers are active */}
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
