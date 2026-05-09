// src/hooks/use-deriv-balance.ts
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { setAuthenticatedAccount, subscribeBalance } from "@/lib/deriv";
import { toast } from "sonner";

export type DerivAccount = {
  account_id: string;
  deriv_token: string;
  is_demo: boolean;
  is_virtual?: boolean | null;
  loginid?: string | null;
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

  // Load all sessions for this user.
  useEffect(() => {
    if (!user || !isBrowser) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("account_id, loginid, deriv_token, is_demo, is_virtual, currency, balance")
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
  }, [user, isBrowser]);

  const active = accounts.find((a) => a.account_id === activeId) ?? null;

  // Subscribe to live balance for the active account.
  useEffect(() => {
    if (!isBrowser || !active || !user) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        setAuthenticatedAccount(
          active.deriv_token,
          active.account_id,
          active.is_virtual ?? active.is_demo,
        );
        console.log("Deriv authenticated WebSocket initialized", {
          account_id: active.account_id,
          loginid: active.loginid,
          is_virtual: active.is_virtual ?? active.is_demo,
        });
        const nextUnsub = await subscribeBalance(active.deriv_token, async (b) => {
          if (cancelled) return;
          setBalance(b.balance);
          if (b.currency) setCurrency(b.currency);

          // Background update to DB
          await supabase
            .from("sessions")
            .update({ balance: b.balance, currency: b.currency })
            .eq("user_id", user.id)
            .eq("account_id", active.account_id);
        });
        if (cancelled) {
          nextUnsub();
          return;
        }
        unsub = nextUnsub;
      } catch (err) {
        if (cancelled) return;
        console.error("Deriv WebSocket auth failure", {
          account_id: active.account_id,
          loginid: active.loginid,
          error: err,
        });
        toast.error("WebSocket authentication failed. Please reconnect your Deriv account.");
      }
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [active, user, isBrowser]);

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
