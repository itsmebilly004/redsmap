import { createContext, useContext, type ReactNode } from "react";
import { type LiveBalance } from "@/hooks/use-deriv-balance";
import { type TradeRequestContext } from "@/lib/deriv-trading-service";
import { type DerivMessage } from "@/lib/deriv";

export interface ITradingContext extends LiveBalance {
  isSimulated?: boolean;
  requestProposal: (payload: Record<string, unknown>, context?: TradeRequestContext) => Promise<DerivMessage>;
  buyProposal: (proposalId: string, price: number, context?: TradeRequestContext) => Promise<DerivMessage>;
  sellContract: (contractId: string, price: number) => Promise<DerivMessage>;
  subscribeOpenContract: (
    contractId: string,
    onUpdate: (contract: Record<string, unknown>, message: DerivMessage) => void
  ) => Promise<() => Promise<void>>;
  subscribeProposal?: (
    payload: Record<string, unknown>,
    onUpdate: (proposal: Record<string, unknown>, message: DerivMessage) => void,
    context?: TradeRequestContext
  ) => Promise<() => Promise<void>>;
}

const TradingContext = createContext<ITradingContext | null>(null);

export function useTradingContext(): ITradingContext {
  const ctx = useContext(TradingContext);
  if (!ctx) {
    throw new Error("useTradingContext must be used inside a TradingProvider");
  }
  return ctx;
}

export function TradingProvider({
  value,
  children,
}: {
  value: ITradingContext;
  children: ReactNode;
}) {
  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
}
