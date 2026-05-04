import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  fetchCandles,
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
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const currentCandleRef = useRef<CandlestickData | null>(null);
  const granularityRef = useRef<number>(60);
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
    return () => {
      off();
    };
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
        secondsVisible: granularity < 60,
      },
      crosshair: { mode: 1 },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load candles + subscribe ticks whenever symbol/timeframe changes.
  useEffect(() => {
    granularityRef.current = granularity;
    let cancelled = false;
    let unsubTicks: (() => void) | undefined;
    currentCandleRef.current = null;

    async function init() {
      if (!seriesRef.current) return;
      try {
        const candles = await fetchCandles(symbol, granularity, 200);
        if (cancelled || !seriesRef.current) return;
        const data: CandlestickData[] = candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        seriesRef.current.setData(data);
        currentCandleRef.current = data[data.length - 1] ?? null;
        chartRef.current?.timeScale().fitContent();
      } catch {
        /* network/timeout: status badge will show */
      }

      unsubTicks = await subscribeTicks(symbol, (price, t) => {
        onPrice?.(price);
        const series = seriesRef.current;
        if (!series) return;
        const g = granularityRef.current;
        const bucket = (Math.floor(t / g) * g) as UTCTimestamp;
        const cur = currentCandleRef.current;
        if (!cur || (cur.time as number) !== bucket) {
          const next: CandlestickData = {
            time: bucket,
            open: price,
            high: price,
            low: price,
            close: price,
          };
          currentCandleRef.current = next;
          series.update(next);
        } else {
          const next: CandlestickData = {
            time: cur.time,
            open: cur.open,
            high: Math.max(cur.high, price),
            low: Math.min(cur.low, price),
            close: price,
          };
          currentCandleRef.current = next;
          series.update(next);
        }
      });
    }
    init();

    return () => {
      cancelled = true;
      unsubTicks?.();
    };
  }, [symbol, granularity, onPrice]);

  const symbolOptions = useMemo(() => {
    if (allSymbols.length === 0) return SYNTHETIC_MARKETS.map((m) => ({ symbol: m.symbol, display_name: m.name }));
    // Prioritize synthetic indices then everything else.
    const syn = allSymbols.filter((s) => s.market === "synthetic_index");
    const rest = allSymbols.filter((s) => s.market !== "synthetic_index");
    return [...syn, ...rest];
  }, [allSymbols]);

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={symbol} onValueChange={(v) => onSymbolChange?.(v)}>
          <SelectTrigger className="w-64 glass-card">
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

        <span
          className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLE[status]}`}
        >
          ● {status}
        </span>
      </div>
      <div
        ref={containerRef}
        style={{ height }}
        className="w-full overflow-hidden rounded-lg border border-glass-border bg-foreground/[0.02]"
      />
    </div>
  );
}
