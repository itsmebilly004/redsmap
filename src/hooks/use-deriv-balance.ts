// src/hooks/use-deriv-balance.ts
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { setAuthenticatedAccount, subscribeBalance } from "@/lib/deriv";
import {
  isDemoAccount,
  isRealAccount,
  isUnknownAccount,
  normalizeDerivAccount,
  type NormalizedDerivAccount,
} from "@/lib/deriv-account";

export type DerivAccount = NormalizedDerivAccount & {
  id?: string;
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
        .select("id, account_id, loginid, deriv_token, is_demo, is_virtual, currency, balance")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("is_demo", { ascending: true });

      if (cancelled) return;
      if (error) {
        setLoading(false);
        return;
      }

      const rawAccounts = (data ?? []) as DerivAccount[];
      console.info("[Deriv Accounts] raw session accounts before normalization", rawAccounts);
      const normalized = rawAccounts
        .map((account) => normalizeDerivAccount(account))
        .filter((account): account is DerivAccount => Boolean(account?.deriv_token));
      console.info("[Deriv Accounts] normalized session accounts", normalized.map((account) => ({
        account_id: account.account_id,
        loginid: account.loginid,
        type: account.type,
        is_demo: account.is_demo,
        is_virtual: account.is_virtual,
        reason: account.classification_reason,
      })));

      for (const account of normalized) {
        if (isUnknownAccount(account)) continue;
        const raw = rawAccounts.find((item) => item.account_id === account.account_id || item.loginid === account.loginid);
        if (!raw) continue;
        if (raw.is_demo !== account.is_demo || raw.is_virtual !== account.is_virtual) {
          console.warn("[Deriv Accounts] correcting stale Supabase account flags", {
            account_id: account.account_id,
            loginid: account.loginid,
            stored_is_demo: raw.is_demo,
            stored_is_virtual: raw.is_virtual,
            normalized_is_demo: account.is_demo,
            normalized_is_virtual: account.is_virtual,
            reason: account.classification_reason,
          });
          if (raw.id) {
            void supabase
              .from("sessions")
              .update({
                is_demo: account.is_demo,
                is_virtual: account.is_virtual,
                loginid: account.loginid,
              })
              .eq("user_id", user.id)
              .eq("id", raw.id);
          }
        }
      }

      const unknownAccounts = normalized.filter(isUnknownAccount);
      if (unknownAccounts.length) {
        console.warn("[Deriv Accounts] unknown accounts excluded from Real/Demo tabs", unknownAccounts);
      }

      const list = normalized.filter((account) => !isUnknownAccount(account));
      console.info("[Deriv Accounts] realAccounts", list.filter(isRealAccount));
      console.info("[Deriv Accounts] demoAccounts", list.filter(isDemoAccount));
      setAccounts(list);
      if (list.length) {
        const savedId = localStorage.getItem(accountStorageKey(user.id));
        const selected =
          list.find((account) => account.account_id === savedId) ??
          list.find(isRealAccount) ??
          list.find(isDemoAccount) ??
          list[0];
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
          isDemoAccount(active),
        );
        console.log("Deriv authenticated WebSocket initialized", {
          account_id: active.account_id,
          loginid: active.loginid,
          is_virtual: isDemoAccount(active),
        });
        const nextUnsub = await subscribeBalance(active.deriv_token, async (b) => {
          if (cancelled) return;
          setBalance(b.balance);
          if (b.currency) setCurrency(b.currency);

          // Background update to DB
          const updateQuery = supabase
            .from("sessions")
            .update({ balance: b.balance, currency: b.currency })
            .eq("user_id", user.id);
          if (active.id) await updateQuery.eq("id", active.id);
          else await updateQuery.eq("account_id", active.account_id);
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
