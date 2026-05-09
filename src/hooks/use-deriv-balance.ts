// src/hooks/use-deriv-balance.ts
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { subscribeBalance } from "@/lib/deriv";

const ACTIVE_ACCOUNT_KEY = "ark_active_account_id";

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

export function useDerivBalance(): LiveBalance {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const isBrowser = typeof window !== "undefined";

  // 1. Load accounts from DB
  useEffect(() => {
    if (!user || !isBrowser) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("account_id, deriv_token, is_demo, currency, balance")
        .eq("user_id", user.id)
        .eq("is_active", true);
      
      if (cancelled) return;
      if (error) {
        setLoading(false);
        return;
      }
      
      const list = (data ?? []) as DerivAccount[];
      setAccounts(list);
      
      if (list.length) {
        // PRIORITY: Check localStorage first, then fallback to first account
        const savedId = localStorage.getItem(ACTIVE_ACCOUNT_KEY);
        const exists = list.find(a => a.account_id === savedId);
        const finalId = exists ? exists.account_id : list[0].account_id;
        
        setActiveId(finalId);
        const activeAcc = list.find(a => a.account_id === finalId);
        setBalance(activeAcc?.balance != null ? Number(activeAcc.balance) : null);
        setCurrency(activeAcc?.currency ?? "");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, isBrowser]);

  const active = accounts.find((a) => a.account_id === activeId) ?? null;

  // 2. Live Subscription
  useEffect(() => {
    if (!isBrowser || !active || !user) return;
    let unsub: (() => void) | undefined;
    
    (async () => {
      try {
        unsub = await subscribeBalance(active.deriv_token, (b) => {
          setBalance(b.balance);
          if (b.currency) setCurrency(b.currency);
          
          supabase.from("sessions")
            .update({ balance: b.balance, currency: b.currency })
            .eq("user_id", user.id)
            .eq("account_id", active.account_id)
            .then();
        });
      } catch (err) {
        console.error("Balance sub error:", err);
      }
    })();
    
    return () => { if (unsub) unsub(); };
  }, [active?.account_id, active?.deriv_token, user, isBrowser]);

  function switchAccount(accountId: string) {
    setActiveId(accountId);
    if (isBrowser) {
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
    }
    const target = accounts.find((a) => a.account_id === accountId);
    if (target) {
      setBalance(target.balance != null ? Number(target.balance) : null);
      setCurrency(target.currency ?? "");
    }
  }

  return { account: active, accounts, balance, currency, loading, switchAccount };
}