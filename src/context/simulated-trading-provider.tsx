import { type ReactNode, useMemo, useCallback } from "react";
import { useSimulatedBalance } from "@/hooks/use-simulated-balance";
import { TradingProvider } from "./trading-context";
import {
  simulatedRequestProposal,
  simulatedBuyProposal,
  simulatedSellContract,
  simulatedSubscribeOpenContract,
} from "@/lib/simulated-trading";
import { useAuth } from "@/hooks/use-auth";

export function SimulatedTradingProvider({ children }: { children: ReactNode }) {
  const balance = useSimulatedBalance();
  const { user } = useAuth();

  const buyProposal = useCallback(
    async (proposalId: string, price: number, context?: any) => {
      if (!user) throw new Error("Must be logged in to trade");
      if (!balance.account) throw new Error("No simulated account selected");
      return simulatedBuyProposal(proposalId, price, user.id, balance.account.account_id);
    },
    [user, balance.account]
  );

  const subscribeOpenContract = useCallback(
    async (contractId: string, onUpdate: any) => {
      if (!user) throw new Error("Must be logged in");
      if (!balance.account) throw new Error("No simulated account selected");
      return simulatedSubscribeOpenContract(contractId, user.id, balance.account.account_id, onUpdate);
    },
    [user, balance.account]
  );

  const value = useMemo(() => {
    return {
      ...balance,
      requestProposal: simulatedRequestProposal,
      buyProposal,
      sellContract: simulatedSellContract,
      subscribeOpenContract,
    };
  }, [balance, buyProposal, subscribeOpenContract]);

  return <TradingProvider value={value}>{children}</TradingProvider>;
}
