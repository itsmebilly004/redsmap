// src/hooks/use-deriv-balance.ts
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { setAuthenticatedAccount, subscribeBalance } from "@/lib/deriv";

export type DerivAccount = {
  account_id: string;
  deriv_token: string;
  is_demo: boolean;
  is_virtual?: boolean | null;
  account_type?: string | null;
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

export function isDerivDemoAccount(
  account: Pick<
    DerivAccount,
    "account_id" | "loginid" | "is_demo" | "is_virtual" | "account_type"
  >,
) {
  const loginId = String(account.loginid ?? account.account_id ?? "").toUpperCase();
  const accountType = String(account.account_type ?? "").toLowerCase();

  if (loginId.startsWith("VRTC") || loginId.startsWith("VR") || loginId.startsWith("DOT")) {
    return true;
  }
  if (loginId.startsWith("CR")) return false;
  if (account.is_virtual === true || account.is_demo === true) return true;
  if (account.is_virtual === false || account.is_demo === false) return false;
  if (accountType.includes("demo") || accountType.includes("virtual")) return true;
  if (accountType.includes("real")) return false;
  return false;
}

function accountStorageKey(userId: string) {
  return `deriv_active_account:${userId}`;
}

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

      const list = ((data ?? []) as DerivAccount[]).map((account) => {
        const isDemo = isDerivDemoAccount(account);
        return {
          ...account,
          is_demo: isDemo,
          is_virtual: isDemo,
        };
      });
      setAccounts(list);
      if (list.length) {
        const savedId = localStorage.getItem(accountStorageKey(user.id));
        const selected = list.find((account) => account.account_id === savedId) ?? list[0];
        setActiveId(selected.account_id);
        setBalance(selected.balance != null ? Number(selected.balance) : null);
        setCurrency(selected.currency ?? "");
      } else {
        setActiveId(null);
        setBalance(null);
        setCurrency("");
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
        console.warn("Deriv live balance sync unavailable", {
          account_id: active.account_id,
          loginid: active.loginid,
          error: err,
        });
      }
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [active, user, isBrowser]);

  function switchAccount(accountId: string) {
    setActiveId(accountId);
    if (user) localStorage.setItem(accountStorageKey(user.id), accountId);
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
