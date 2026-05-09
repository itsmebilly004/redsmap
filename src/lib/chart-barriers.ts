import type { IPriceLine, ISeriesApi } from "lightweight-charts";

export type BarrierLineRefs = {
  entry: IPriceLine | null;
  lower: IPriceLine | null;
  upper: IPriceLine | null;
};

export type BarrierLines = {
  entryPrice?: number | null;
  lowerBarrier?: number | null;
  upperBarrier?: number | null;
  breached?: boolean;
};

type BaseSeries = ISeriesApi<"Area"> | ISeriesApi<"Candlestick">;

export function clearBarrierLines(series: BaseSeries | null | undefined, refs: BarrierLineRefs) {
  if (!series) return;
  for (const key of ["entry", "lower", "upper"] as const) {
    if (!refs[key]) continue;
    try {
      series.removePriceLine(refs[key]);
    } catch {
      /* ignore */
    }
    refs[key] = null;
  }
}

export function renderBarrierLines(
  series: BaseSeries | null | undefined,
  refs: BarrierLineRefs,
  lines: BarrierLines,
) {
  if (!series) return;
  clearBarrierLines(series, refs);
  if (lines.upperBarrier != null && Number.isFinite(lines.upperBarrier)) {
    refs.upper = series.createPriceLine({
      price: lines.upperBarrier,
      color: lines.breached ? "#ff444f" : "#2196f3",
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "Upper barrier",
    });
  }
  if (lines.lowerBarrier != null && Number.isFinite(lines.lowerBarrier)) {
    refs.lower = series.createPriceLine({
      price: lines.lowerBarrier,
      color: lines.breached ? "#ff444f" : "#2196f3",
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "Lower barrier",
    });
  }
  if (lines.entryPrice != null && Number.isFinite(lines.entryPrice)) {
    refs.entry = series.createPriceLine({
      price: lines.entryPrice,
      color: "#4bb4b3",
      lineWidth: 1,
      lineStyle: 1,
      axisLabelVisible: true,
      title: "Entry",
    });
  }
}
