import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { subscribeBalance } from "@/lib/deriv";

export type DerivAccount = {
  account_id: string;
  deriv_token: string;
  is_demo: boolean;
  currency: string;
  balance: number | null;
};

export type DerivBalanceContextType = {
  account: DerivAccount | null;
  accounts: DerivAccount[];
  balance: number | null;
  currency: string;
  loading: boolean;
  switchAccount: (accountId: string) => void;
  logout: () => Promise<void>;
};

const DerivBalanceContext = createContext<DerivBalanceContextType>({
  account: null,
  accounts: [],
  balance: null,
  currency: "USD",
  loading: true,
  switchAccount: () => {},
  logout: async () => {},
});

export function DerivBalanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>("USD");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setActiveId(null);
      setBalance(null);
      setCurrency("USD");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("sessions")
        .select("account_id, deriv_token, is_demo, currency, balance")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .gt("expires_at", now)
        .order("is_demo", { ascending: true }); // real accounts first
      if (cancelled) return;
      if (error) {
        setLoading(false);
        return;
      }
      const list: DerivAccount[] = (data ?? []).map((a) => ({
        account_id: a.account_id,
        deriv_token: a.deriv_token,
        is_demo: a.is_demo ?? false,
        currency: a.currency ?? "USD",
        balance: a.balance != null ? Number(a.balance) : null,
      }));
      setAccounts(list);
      if (list.length) {
        const first = list[0];
        setActiveId(first.account_id);
        setBalance(first.balance);
        setCurrency(first.currency);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const active = accounts.find((a) => a.account_id === activeId) ?? null;

  // When active account changes, sync balance + currency immediately
  useEffect(() => {
    if (active) {
      setBalance(active.balance);
      setCurrency(active.currency);
    }
  }, [activeId]);

  // Subscribe to live balance for the active account
  useEffect(() => {
    if (!active || !user) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        unsub = await subscribeBalance(active.deriv_token, async (b) => {
          if (cancelled) return;
          setBalance(b.balance);
          setCurrency(b.currency);
          // Keep accounts list in sync
          setAccounts((prev) =>
            prev.map((a) =>
              a.account_id === active.account_id
                ? { ...a, balance: b.balance, currency: b.currency }
                : a,
            ),
          );
          // Persist to Supabase in background
          supabase
            .from("sessions")
            .update({ balance: b.balance, currency: b.currency })
            .eq("user_id", user.id)
            .eq("account_id", active.account_id)
            .then(() => {});
        });
      } catch {
        /* network errors surfaced via connection status badge */
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [activeId, active?.deriv_token, user?.id]);

  async function logout() {
    // Mark all sessions inactive so next login starts fresh
    if (user) {
      await supabase
        .from("sessions")
        .update({ is_active: false })
        .eq("user_id", user.id);
    }
    await supabase.auth.signOut();
  }

  function switchAccount(accountId: string) {
    const found = accounts.find((a) => a.account_id === accountId);
    if (!found) return;
    setActiveId(accountId);
  }

  return (
    <DerivBalanceContext.Provider
      value={{ account: active, accounts, balance, currency, loading, switchAccount, logout }}
    >
      {children}
    </DerivBalanceContext.Provider>
  );
}

export function useDerivBalance(): DerivBalanceContextType {
  return useContext(DerivBalanceContext);
}
