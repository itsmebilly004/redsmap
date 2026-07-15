import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { DerivAccount, LiveBalance } from "./use-deriv-balance";
import { normalizeDerivAccount } from "@/lib/deriv-account";

export function useSimulatedBalance(): LiveBalance {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from("sessions").select("*").eq("user_id", user.id);
    if (!error && data) {
      const parsed = data.map((row) => ({
        ...row,
        ...normalizeDerivAccount({
          account_id: row.account_id,
          is_virtual: row.is_demo ? 1 : 0,
          currency: row.currency,
          balance: row.balance,
        } as any),
      })) as DerivAccount[];
      setAccounts(parsed);
      
      setActiveId(prev => prev || (data.length > 0 ? data[0].account_id : null));
      if (data.length > 0 && !activeId) {
        setBalance(parsed[0].balance);
        setCurrency(parsed[0].currency || "USD");
      }
    }
  }, [user, activeId]);

  useEffect(() => {
    fetchAccounts().finally(() => setLoading(false));
  }, [fetchAccounts]);

  // Subscribe to changes in the sessions table for the active account
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("simulated-balance-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          setAccounts((prev) =>
            prev.map((acc) =>
              acc.account_id === row.account_id ? { ...acc, balance: row.balance, currency: row.currency } : acc
            )
          );
          setActiveId((currentActiveId) => {
            if (row.account_id === currentActiveId) {
              setBalance(row.balance);
              setCurrency(row.currency || "USD");
            }
            return currentActiveId;
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const refreshBalances = useCallback(async () => {
    setRefreshing(true);
    await fetchAccounts();
    setRefreshing(false);
  }, [fetchAccounts]);

  const switchAccount = useCallback(
    (accountId: string) => {
      setActiveId(accountId);
      const target = accounts.find((account) => account.account_id === accountId);
      if (target) {
        setBalance(target.balance != null ? Number(target.balance) : null);
        setCurrency(target.currency ?? "USD");
      }
    },
    [accounts]
  );

  const active = useMemo(
    () => accounts.find((account) => account.account_id === activeId) ?? null,
    [accounts, activeId]
  );

  return {
    account: active,
    accounts,
    balance,
    currency,
    loading,
    refreshing,
    refreshBalances,
    switchAccount,
  };
}
