import type { TradeCategory } from "@/lib/deriv";

/**
 * One-shot handoff between the AI assistant and the manual trader page (`/`).
 * The AI writes a suggested {symbol, tradeType, stake} into sessionStorage,
 * the manual trader reads it on mount and immediately clears it so a later
 * page refresh doesn't keep re-applying stale suggestions.
 */
export type ManualTradePickup = {
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

const STORAGE_KEY = "arktrader:ai-manual-pickup";

export function setManualTradePickup(pickup: ManualTradePickup): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pickup));
  } catch {
    /* sessionStorage may be blocked in privacy mode — ignore */
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
    return {
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
