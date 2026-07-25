import { type ReactNode, useMemo } from "react";
import { useDerivBalance } from "@/hooks/use-deriv-balance";
import { TradingProvider, useTradingContext } from "./trading-context";
import {
  requestProposal,
  buyProposal,
  sellContract,
  subscribeOpenContract,
  subscribeProposal,
} from "@/lib/deriv-trading-service";

export function DerivBalanceProvider({ children }: { children: ReactNode }) {
  const balance = useDerivBalance();

  const value = useMemo(() => {
    return {
      ...balance,
      requestProposal,
      buyProposal,
      sellContract,
      subscribeOpenContract,
      subscribeProposal,
    };
  }, [balance]);

  return <TradingProvider value={value}>{children}</TradingProvider>;
}

export function useDerivBalanceContext() {
  return useTradingContext();
}
