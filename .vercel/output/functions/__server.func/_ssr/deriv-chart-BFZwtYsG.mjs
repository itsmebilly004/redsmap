import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import { a as ae, G as Ge, C as Ce, U as Ue } from "../_libs/lightweight-charts.mjs";
import { k as getActiveSymbols, g as SYNTHETIC_MARKETS, o as onStatus, l as fetchTicks, m as fetchCandles, f as subscribeTicks } from "./router-C5J15k2c.mjs";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, e as SelectGroup, f as SelectLabel, d as SelectItem } from "./select-BhjPe795.mjs";
import { D as DropdownMenu, a as DropdownMenuTrigger, b as DropdownMenuContent, c as DropdownMenuItem } from "./dropdown-menu-C9_FfC1I.mjs";
import { c as cn } from "./button-Cz8PAkJh.mjs";
import { h as ChevronDown, l as ChartLine, a2 as ChartCandlestick, a3 as ChartNoAxesColumn } from "../_libs/lucide-react.mjs";
const CANDLE_TIMEFRAMES = [
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
  { label: "15m", value: 900 },
  { label: "1H", value: 3600 },
  { label: "4H", value: 14400 },
  { label: "1D", value: 86400 }
];
const STATUS_STYLE = {
  connecting: "bg-yellow-400/20 text-yellow-600",
  connected: "bg-green-500/20 text-green-600",
  reconnecting: "bg-orange-500/20 text-orange-600",
  disconnected: "bg-red-500/20 text-red-600"
};
const MARKET_LABEL = {
  synthetic_index: "Synthetics",
  forex: "Forex",
  cryptocurrency: "Crypto",
  indices: "Indices",
  commodities: "Commodities",
  energy: "Energy",
  metals: "Metals",
  stock_index: "Stock Indices"
};
const CHART_TYPE_ICONS = {
  area: /* @__PURE__ */ jsxRuntimeExports.jsx(ChartNoAxesColumn, { className: "size-4" }),
  candlestick: /* @__PURE__ */ jsxRuntimeExports.jsx(ChartCandlestick, { className: "size-4" }),
  line: /* @__PURE__ */ jsxRuntimeExports.jsx(ChartLine, { className: "size-4" })
};
const CHART_TYPE_LABELS = {
  area: "Area",
  candlestick: "Candles",
  line: "Line"
};
function DerivChart({
  symbol,
  onSymbolChange,
  onPrice,
  height = 420,
  className,
  highBarrier,
  lowBarrier,
  isAccumulator = false
}) {
  const containerRef = reactExports.useRef(null);
  const chartRef = reactExports.useRef(null);
  const seriesRef = reactExports.useRef(null);
  const highLineRef = reactExports.useRef(null);
  const lowLineRef = reactExports.useRef(null);
  const [chartType, setChartType] = reactExports.useState("area");
  const [granularity, setGranularity] = reactExports.useState(60);
  const [status, setStatus] = reactExports.useState("connecting");
  const [allSymbols, setAllSymbols] = reactExports.useState([]);
  const effectiveChartType = isAccumulator ? "area" : chartType;
  const useTicks = isAccumulator || granularity === 0;
  reactExports.useEffect(() => {
    getActiveSymbols().then((list) => {
      if (list?.length) setAllSymbols(list);
    }).catch(() => {
      setAllSymbols(
        SYNTHETIC_MARKETS.map((m) => ({
          symbol: m.symbol,
          display_name: m.name,
          market: "synthetic_index"
        }))
      );
    });
  }, []);
  reactExports.useEffect(() => {
    const off = onStatus(setStatus);
    return () => {
      off();
    };
  }, []);
  reactExports.useEffect(() => {
    if (!containerRef.current) return;
    const chart = ae(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(120,120,140,0.9)",
        fontFamily: "Inter, system-ui, sans-serif"
      },
      grid: {
        vertLines: { color: "rgba(120,120,140,0.08)" },
        horzLines: { color: "rgba(120,120,140,0.08)" }
      },
      rightPriceScale: { borderColor: "rgba(120,120,140,0.15)" },
      timeScale: {
        borderColor: "rgba(120,120,140,0.15)",
        timeVisible: true,
        secondsVisible: granularity <= 300
      },
      crosshair: { mode: 1 }
    });
    chartRef.current = chart;
    addSeries(chart, effectiveChartType);
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [effectiveChartType]);
  function addSeries(chart, type) {
    if (seriesRef.current) {
      try {
        chart.removeSeries(seriesRef.current);
      } catch {
      }
      seriesRef.current = null;
    }
    if (type === "candlestick") {
      seriesRef.current = chart.addSeries(Ge, {
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350"
      });
    } else if (type === "line") {
      seriesRef.current = chart.addSeries(Ce, {
        color: "#1f2937",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4
      });
    } else {
      seriesRef.current = chart.addSeries(Ue, {
        lineColor: "#1f2937",
        lineWidth: 2,
        topColor: "rgba(31,41,55,0.18)",
        bottomColor: "rgba(31,41,55,0.0)",
        priceLineVisible: true,
        priceLineColor: "#111827",
        priceLineWidth: 1,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4
      });
    }
  }
  reactExports.useEffect(() => {
    if (!chartRef.current) return;
    addSeries(chartRef.current, effectiveChartType);
  }, [effectiveChartType]);
  reactExports.useEffect(() => {
    let cancelled = false;
    let unsubTicks;
    async function init() {
      const series = seriesRef.current;
      if (!series) return;
      series.setData([]);
      if (useTicks) {
        try {
          const ticks = await fetchTicks(symbol, 500);
          if (cancelled || !seriesRef.current) return;
          const data = ticks.map((t) => ({
            time: t.time,
            value: t.price
          }));
          seriesRef.current.setData(data);
          chartRef.current?.timeScale().scrollToRealTime();
        } catch {
        }
      } else {
        try {
          const candles = await fetchCandles(symbol, granularity, 500);
          if (cancelled || !seriesRef.current) return;
          if (effectiveChartType === "candlestick") {
            const data = candles.map((c) => ({
              time: c.time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close
            }));
            seriesRef.current.setData(data);
          } else {
            const data = candles.map((c) => ({
              time: c.time,
              value: c.close
            }));
            seriesRef.current.setData(data);
          }
          chartRef.current?.timeScale().fitContent();
        } catch {
        }
      }
      unsubTicks = await subscribeTicks(symbol, (price, t) => {
        onPrice?.(price);
        const s = seriesRef.current;
        if (!s) return;
        if (effectiveChartType === "candlestick" && !useTicks) {
          s.update({ time: t, open: price, high: price, low: price, close: price });
        } else {
          s.update({ time: t, value: price });
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
  reactExports.useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (highLineRef.current) {
      try {
        series.removePriceLine(highLineRef.current);
      } catch {
      }
      highLineRef.current = null;
    }
    if (lowLineRef.current) {
      try {
        series.removePriceLine(lowLineRef.current);
      } catch {
      }
      lowLineRef.current = null;
    }
    if (highBarrier != null && Number.isFinite(highBarrier)) {
      highLineRef.current = series.createPriceLine({
        price: highBarrier,
        color: "#00C853",
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        title: "▲ High"
      });
    }
    if (lowBarrier != null && Number.isFinite(lowBarrier)) {
      lowLineRef.current = series.createPriceLine({
        price: lowBarrier,
        color: "#FF1744",
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        title: "▼ Low"
      });
    }
  }, [highBarrier, lowBarrier]);
  const groupedSymbols = reactExports.useMemo(() => {
    const source = allSymbols.length === 0 ? SYNTHETIC_MARKETS.map((m) => ({
      symbol: m.symbol,
      display_name: m.name,
      market: "synthetic_index"
    })) : allSymbols;
    const groups = {};
    const order = ["synthetic_index", "forex", "cryptocurrency", "indices", "commodities", "metals", "energy"];
    for (const s of source) {
      if (!groups[s.market]) groups[s.market] = [];
      groups[s.market].push({ symbol: s.symbol, display_name: s.display_name });
    }
    const orderedGroups = [];
    for (const m of order) {
      if (groups[m]) orderedGroups.push({ market: m, items: groups[m] });
    }
    for (const m of Object.keys(groups)) {
      if (!order.includes(m)) orderedGroups.push({ market: m, items: groups[m] });
    }
    return orderedGroups;
  }, [allSymbols]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-3 flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Select, { value: symbol, onValueChange: (v) => onSymbolChange?.(v), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "w-48 sm:w-64 glass-card", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { className: "max-h-96 overflow-y-auto", children: groupedSymbols.map(({ market, items }) => /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectGroup, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(SelectLabel, { className: "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", children: MARKET_LABEL[market] ?? market }),
          items.map((m) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: m.symbol, children: m.display_name }, m.symbol))
        ] }, market)) })
      ] }),
      !isAccumulator && /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "flex items-center gap-1.5 rounded-md border border-glass-border bg-background px-2 py-1.5 text-xs hover:bg-foreground/5", children: [
          CHART_TYPE_ICONS[chartType],
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hidden sm:inline", children: CHART_TYPE_LABELS[chartType] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "size-3 text-muted-foreground" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuContent, { align: "start", children: ["area", "candlestick", "line"].map((t) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
          DropdownMenuItem,
          {
            onClick: () => setChartType(t),
            className: cn("gap-2", chartType === t && "bg-muted"),
            children: [
              CHART_TYPE_ICONS[t],
              CHART_TYPE_LABELS[t]
            ]
          },
          t
        )) })
      ] }),
      !isAccumulator && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex overflow-hidden rounded-md border border-glass-border", children: CANDLE_TIMEFRAMES.map((tf) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          onClick: () => setGranularity(tf.value),
          className: [
            "px-2.5 py-1.5 text-xs font-medium transition-colors",
            granularity === tf.value ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-foreground/5"
          ].join(" "),
          children: tf.label
        },
        tf.value
      )) }),
      isAccumulator && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700", children: "Tick Chart — Accumulator Mode" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "span",
        {
          className: `ml-auto rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLE[status]}`,
          children: [
            "● ",
            status
          ]
        }
      )
    ] }),
    isAccumulator && highBarrier != null && lowBarrier != null && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-glass-border bg-foreground/[0.02] px-3 py-1.5 text-xs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1.5 font-mono font-semibold text-emerald-600", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-block h-0.5 w-4 bg-emerald-500" }),
        "High ",
        highBarrier.toFixed(4)
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1.5 font-mono font-semibold text-red-500", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-block h-0.5 w-4 bg-red-500" }),
        "Low ",
        lowBarrier.toFixed(4)
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-muted-foreground", children: [
        "Zone ±",
        ((highBarrier - lowBarrier) / 2 / ((highBarrier + lowBarrier) / 2) * 100).toFixed(4),
        "%"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        ref: containerRef,
        style: { height },
        className: "w-full overflow-hidden rounded-lg border border-glass-border bg-foreground/[0.02]"
      }
    )
  ] });
}
export {
  DerivChart as D
};
