import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { subscribeBalance } from "@/lib/deriv";

export type DerivAccount = {
  account_id: string;
  deriv_token: string;
  is_demo: boolean;
  currency: string | null;
  balance: number | null;
};

export type LiveBalance = {
  account: DerivAccount | null;
  accounts: DerivAccount[];
  balance: number | null;
  currency: string;
  loading: boolean;
  switchAccount: (accountId: string) => void;
};

/**
 * Loads the user's Deriv sessions and subscribes to live balance updates
 * for the active account — same logic Deriv uses (authorize → balance stream).
 */
export function useDerivBalance(): LiveBalance {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Load all sessions for this user.
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("account_id, deriv_token, is_demo, currency, balance")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("is_demo", { ascending: true });
      if (cancelled) return;
      if (error) {
        setLoading(false);
        return;
      }
      const list = (data ?? []) as DerivAccount[];
      setAccounts(list);
      if (list.length) {
        setActiveId(list[0].account_id);
        setBalance(list[0].balance != null ? Number(list[0].balance) : null);
        setCurrency(list[0].currency ?? "");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const active = accounts.find((a) => a.account_id === activeId) ?? null;

  // Subscribe to live balance for the active account.
  useEffect(() => {
    if (!active || !user) return;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        unsub = await subscribeBalance(active.deriv_token, async (b) => {
          setBalance(b.balance);
          if (b.currency) setCurrency(b.currency);
          await supabase
            .from("sessions")
            .update({ balance: b.balance, currency: b.currency })
            .eq("user_id", user.id)
            .eq("account_id", active.account_id);
        });
      } catch {
        /* network errors handled by status badge */
      }
    })();
    return () => {
      unsub?.();
    };
  }, [active?.account_id, active?.deriv_token, user]);

  function switchAccount(accountId: string) {
    setActiveId(accountId);
    const target = accounts.find((a) => a.account_id === accountId);
    if (target) {
      setBalance(target.balance != null ? Number(target.balance) : null);
      setCurrency(target.currency ?? "");
    }
  }

  return {
    account: active,
    accounts,
    balance,
    currency,
    loading,
    switchAccount,
  };
}
