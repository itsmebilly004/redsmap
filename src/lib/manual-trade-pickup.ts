import type { TradeCategory } from "@/lib/deriv";

/**
 * One-shot handoff between the AI assistant and the manual trader page (`/`).
 * The AI writes a suggested {symbol, tradeType, stake} into sessionStorage,
 * the manual trader reads it on mount and immediately clears it so a later
 * page refresh doesn't keep re-applying stale suggestions.
 */
export type ManualTradePickup = {
  /**
   * When true, the manual trader fires ONE trade automatically on the AI-picked
   * side once the trading connection + proposal are ready (single auto-trade).
   */
  autoRun?: boolean;
  /** Contract duration in ticks the user chose before the AI scan. Pre-fills the panel. */
  durationTicks?: number;
  /**
   * Prediction digit for digit contracts — the Over/Under threshold or the
   * Matches/Differs target digit the AI selected. Ignored for non-digit families.
   */
  predictionDigit?: number;
  /**
   * Resolved trade-type side VALUE for the auto-trade (e.g. "even"/"odd",
   * "over"/"under", "matches"/"differs", "up"/"down"). Matches the trade-type
   * config side `value`, not the human label.
   */
  side?: string;
  /** Recommended opening stake — manual trader pre-fills this in the panel. */
  stake: number;
  /** Session stop-loss the user entered before the AI scan (0 = disabled). */
  stopLoss?: number;
  /** Synthetic index symbol (e.g. "R_100", "1HZ10V"). */
  symbol: string;
  /** Session take-profit the user entered before the AI scan (0 = disabled). */
  takeProfit?: number;
  /** Contract family the user chose in the AI assistant. */
  tradeType: TradeCategory;
};

const STORAGE_KEY = "Redsmap:ai-manual-pickup";

/**
 * Fired right after a pickup is written so a manual-trader page that is ALREADY
 * mounted (the AI assistant can be launched from `/` itself, where navigating to
 * `/` does not remount the route) can consume it live instead of waiting for a
 * remount that never happens.
 */
export const MANUAL_TRADE_PICKUP_EVENT = "Redsmap:ai-manual-pickup";

export function setManualTradePickup(pickup: ManualTradePickup): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pickup));
  } catch {
    /* sessionStorage may be blocked in privacy mode — ignore */
  }
  // Notify an already-mounted manual trader. Defer so the navigate() that
  // typically follows has a chance to mount the page first when coming from
  // another route (the mounted-page case is handled by the listener).
  try {
    window.dispatchEvent(new CustomEvent(MANUAL_TRADE_PICKUP_EVENT));
  } catch {
    /* CustomEvent unsupported — the mount-time consume path still applies */
  }
}

export function consumeManualTradePickup(): ManualTradePickup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as Partial<ManualTradePickup>;
    if (
      typeof parsed.symbol !== "string" ||
      typeof parsed.tradeType !== "string" ||
      typeof parsed.stake !== "number" ||
      !Number.isFinite(parsed.stake)
    ) {
      return null;
    }
    const sanitizeOptional = (value: unknown): number | undefined => {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? number : undefined;
    };
    const sanitizeDigit = (value: unknown): number | undefined => {
      const number = Number(value);
      return Number.isInteger(number) && number >= 0 && number <= 9 ? number : undefined;
    };
    const sanitizeTicks = (value: unknown): number | undefined => {
      const number = Number(value);
      return Number.isInteger(number) && number >= 1 && number <= 10 ? number : undefined;
    };
    return {
      autoRun: parsed.autoRun === true,
      durationTicks: sanitizeTicks(parsed.durationTicks),
      predictionDigit: sanitizeDigit(parsed.predictionDigit),
      side: typeof parsed.side === "string" && parsed.side ? parsed.side : undefined,
      stake: Math.max(0.35, parsed.stake),
      stopLoss: sanitizeOptional(parsed.stopLoss),
      symbol: parsed.symbol,
      takeProfit: sanitizeOptional(parsed.takeProfit),
      tradeType: parsed.tradeType as TradeCategory,
    };
  } catch {
    return null;
  }
}
