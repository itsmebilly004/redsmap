import { useEffect, useRef, useState } from "react";
import { useDerivBalance } from "@/contexts/deriv-balance";
import {
  send,
  sellContract,
  subscribeOpenContract,
  fetchPortfolio,
} from "@/lib/deriv";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Module-level registry so trade-panel can notify the panel about new contracts
// without needing prop drilling or context.
type RegisterFn = (contractId: number) => void;
let _registerCallback: RegisterFn | null = null;

export function registerOpenContract(contractId: number) {
  _registerCallback?.(contractId);
}

interface OpenContract {
  contract_id: number;
  contract_type: string;
  underlying: string;
  buy_price: number;
  bid_price: number | null;
  profit: number | null;
  profit_percentage: number | null;
  is_sold: boolean;
  is_valid_to_sell: boolean;
  status: "open" | "won" | "lost";
  entry_spot: number | null;
  current_spot: number | null;
  currency: string;
}

const CONTRACT_LABELS: Record<string, string> = {
  CALL: "Rise", PUT: "Fall",
  CALLE: "Higher", PUTE: "Lower",
  ONETOUCH: "Touch", NOTOUCH: "No Touch",
  DIGITEVEN: "Even", DIGITODD: "Odd",
  DIGITOVER: "Over", DIGITUNDER: "Under",
  DIGITMATCH: "Matches", DIGITDIFF: "Differs",
  ACCU: "Accumulator", MULTUP: "Mult Up", MULTDOWN: "Mult Down",
};

function contractLabel(type: string) {
  return CONTRACT_LABELS[type] ?? type;
}

export function OpenContractsPanel() {
  const { account } = useDerivBalance();
  const [contracts, setContracts] = useState<Map<number, OpenContract>>(new Map());
  const unsubsRef = useRef<Map<number, () => void>>(new Map());
  const [selling, setSelling] = useState<Set<number>>(new Set());

  // Register this component as the global recipient for new contract IDs
  useEffect(() => {
    _registerCallback = (contractId: number) => {
      void subscribeToContract(contractId);
    };
    return () => {
      _registerCallback = null;
    };
  });

  // Load portfolio when account changes, then subscribe to each open contract
  useEffect(() => {
    if (!account) {
      setContracts(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await send({ authorize: account.deriv_token });
        const portfolio = await fetchPortfolio();
        if (cancelled) return;
        for (const c of portfolio) {
          void subscribeToContract(Number(c.contract_id));
        }
      } catch {
        /* portfolio unavailable — no-op */
      }
    })();
    return () => { cancelled = true; };
  }, [account?.account_id]);

  // Clean up subscriptions on unmount
  useEffect(() => {
    return () => {
      for (const unsub of unsubsRef.current.values()) unsub();
      unsubsRef.current.clear();
    };
  }, []);

  async function subscribeToContract(contractId: number) {
    if (unsubsRef.current.has(contractId)) return;
    try {
      const unsub = await subscribeOpenContract(contractId, (c) => {
        const profit = c.profit != null ? Number(c.profit) : null;
        const pct = c.profit_percentage != null ? Number(c.profit_percentage) : null;
        const sold = !!c.is_sold;
        setContracts((prev) => {
          const next = new Map(prev);
          next.set(contractId, {
            contract_id: contractId,
            contract_type: c.contract_type ?? "",
            underlying: c.underlying_symbol ?? c.display_name ?? "",
            buy_price: Number(c.buy_price ?? 0),
            bid_price: c.bid_price != null ? Number(c.bid_price) : null,
            profit,
            profit_percentage: pct,
            is_sold: sold,
            is_valid_to_sell: !!c.is_valid_to_sell,
            status: sold ? (profit != null && profit >= 0 ? "won" : "lost") : "open",
            entry_spot: c.entry_spot != null ? Number(c.entry_spot) : null,
            current_spot: c.current_spot != null ? Number(c.current_spot) : null,
            currency: c.currency ?? "USD",
          });
          return next;
        });
        if (sold) {
          // Remove 8 s after settlement
          setTimeout(() => {
            setContracts((prev) => { const m = new Map(prev); m.delete(contractId); return m; });
            unsubsRef.current.get(contractId)?.();
            unsubsRef.current.delete(contractId);
          }, 8000);
        }
      });
      unsubsRef.current.set(contractId, unsub);
    } catch { /* ignore */ }
  }

  async function handleSell(contractId: number, bidPrice: number | null) {
    setSelling((s) => new Set(s).add(contractId));
    try {
      await sellContract(contractId, bidPrice ?? 0);
      toast.success("Contract sold");
    } catch (e: any) {
      toast.error(e.message ?? "Could not sell contract");
    } finally {
      setSelling((s) => { const n = new Set(s); n.delete(contractId); return n; });
    }
  }

  function dismiss(contractId: number) {
    setContracts((prev) => { const m = new Map(prev); m.delete(contractId); return m; });
    unsubsRef.current.get(contractId)?.();
    unsubsRef.current.delete(contractId);
  }

  const list = Array.from(contracts.values());
  if (!list.length) return null;

  const openCount = list.filter((c) => !c.is_sold).length;

  return (
    <section className="border-t border-[oklch(0.92_0.005_240)] bg-white px-3 py-3 lg:px-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.02_260)]">
        Open Contracts ({openCount})
      </div>
      <div className="flex flex-col gap-2">
        {list.map((c) => {
          const profit = c.profit ?? 0;
          const isWin = profit >= 0;
          const settled = c.is_sold;
          return (
            <div
              key={c.contract_id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm",
                settled
                  ? isWin
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-rose-200 bg-rose-50"
                  : "border-[oklch(0.92_0.005_240)] bg-[oklch(0.98_0.003_240)]",
              )}
            >
              {/* Status icon */}
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-white",
                  settled
                    ? isWin ? "bg-emerald-500" : "bg-rose-500"
                    : "bg-[oklch(0.55_0.22_265)]",
                )}
              >
                {settled ? (
                  isWin ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />
                ) : (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <span>{contractLabel(c.contract_type)}</span>
                  <span className="text-[10px] text-[oklch(0.55_0.02_260)]">· {c.underlying}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-[oklch(0.5_0.02_260)]">
                  <span>Stake {c.buy_price.toFixed(2)} {c.currency}</span>
                  {c.entry_spot != null && <span>Entry {c.entry_spot.toFixed(4)}</span>}
                  {!settled && c.current_spot != null && (
                    <span>Now {c.current_spot.toFixed(4)}</span>
                  )}
                </div>
              </div>

              {/* P&L */}
              <div className="shrink-0 text-right">
                <div
                  className={cn(
                    "font-mono text-sm font-semibold tabular-nums",
                    c.profit != null
                      ? isWin ? "text-emerald-600" : "text-rose-600"
                      : "text-[oklch(0.45_0.02_260)]",
                  )}
                >
                  {c.profit != null
                    ? `${isWin ? "+" : ""}${profit.toFixed(2)} ${c.currency}`
                    : "—"}
                </div>
                {c.profit_percentage != null && !settled && (
                  <div className={cn("text-[10px]", isWin ? "text-emerald-500" : "text-rose-500")}>
                    {isWin ? "+" : ""}{c.profit_percentage.toFixed(2)}%
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="shrink-0">
                {settled ? (
                  <button
                    onClick={() => dismiss(c.contract_id)}
                    className="rounded-full p-1 hover:bg-black/5"
                    aria-label="Dismiss"
                  >
                    <X className="size-3.5 text-[oklch(0.5_0.02_260)]" />
                  </button>
                ) : c.is_valid_to_sell ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selling.has(c.contract_id)}
                    onClick={() => handleSell(c.contract_id, c.bid_price)}
                    className="h-7 px-2 text-xs"
                  >
                    {selling.has(c.contract_id)
                      ? <Loader2 className="size-3 animate-spin" />
                      : "Sell"}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
