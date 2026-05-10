// src/hooks/use-deriv-balance.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { setAuthenticatedAccount, subscribeBalance } from "@/lib/deriv";
import {
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
  const [reloadNonce, setReloadNonce] = useState(0);
  const lastWebSocketAccountKeyRef = useRef<string | null>(null);

  const isBrowser = typeof window !== "undefined";

  useEffect(() => {
    if (!isBrowser) return;
    const refreshSessions = (event: Event) => {
      console.info("[Deriv Balance] session context refresh requested", {
        detail: event instanceof CustomEvent ? event.detail : null,
      });
      setLoading(true);
      setReloadNonce((value) => value + 1);
    };
    window.addEventListener("deriv:sessions-updated", refreshSessions);
    return () => window.removeEventListener("deriv:sessions-updated", refreshSessions);
  }, [isBrowser]);

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
        .map((account) => normalizeDerivAccount(account, { trustVirtualFlags: false }))
        .filter((account): account is DerivAccount => Boolean(account?.deriv_token));
      console.info("[Deriv Accounts] normalized session accounts", normalized.map((account) => ({
        account_id: account.account_id,
        loginid: account.loginid,
        raw_account_id: rawAccounts.find((raw) => raw.id === account.id)?.account_id,
        raw_loginid: rawAccounts.find((raw) => raw.id === account.id)?.loginid,
        detected_prefix: account.detected_prefix,
        normalizedType: account.normalizedType,
        final_tab_placement: account.final_tab_placement,
        is_demo: account.is_demo,
        is_virtual: account.is_virtual,
        reason: account.classification_reason,
      })));

      for (const account of normalized) {
        if (account.normalizedType === "unknown") continue;
        const raw = rawAccounts.find((item) => item.account_id === account.account_id || item.loginid === account.loginid);
        if (!raw) continue;
        if (
          raw.is_demo !== account.is_demo ||
          raw.is_virtual !== account.is_virtual ||
          raw.loginid !== account.loginid
        ) {
          console.warn("[Deriv Accounts] correcting stale Supabase account flags", {
            account_id: account.account_id,
            loginid: account.loginid,
            detected_prefix: account.detected_prefix,
            normalizedType: account.normalizedType,
            final_tab_placement: account.final_tab_placement,
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

      const unknownAccounts = normalized.filter((account) => account.normalizedType === "unknown");
      if (unknownAccounts.length) {
        console.warn("[Deriv Accounts] unknown accounts excluded from Real/Demo tabs", unknownAccounts);
      }

      const list = normalized.filter((account) => account.normalizedType !== "unknown");
      const realAccounts = list.filter((account) => account.normalizedType === "real");
      const demoAccounts = list.filter((account) => account.normalizedType === "demo");
      console.info("[Deriv Accounts] realAccounts", realAccounts);
      console.info("[Deriv Accounts] demoAccounts", demoAccounts);
      setAccounts(list);
      if (list.length) {
        const savedId = localStorage.getItem(accountStorageKey(user.id));
        const savedAccount = list.find((account) => account.account_id === savedId);
        const selected =
          (savedAccount?.normalizedType === "real" ? savedAccount : null) ??
          realAccounts[0] ??
          savedAccount ??
          demoAccounts[0] ??
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
  }, [user, isBrowser, reloadNonce]);

  const active = useMemo(
    () => accounts.find((account) => account.account_id === activeId) ?? null,
    [accounts, activeId],
  );
  const activeAccountKey = active
    ? `${active.deriv_token}:${active.account_id}:${active.normalizedType}`
    : null;

  // Subscribe to live balance for the active account.
  useEffect(() => {
    if (!isBrowser || !active || !user || !activeAccountKey) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    const activeIsDemo = active.normalizedType === "demo";
    const requestedAccountId = active.account_id;
    const previousAccountKey = lastWebSocketAccountKeyRef.current;

    (async () => {
      try {
        if (previousAccountKey !== activeAccountKey) {
          console.info("[Deriv Balance] Initializing Deriv WebSocket account", {
            previousSelectedAccountKey: previousAccountKey,
            requestedAccountId,
            requestedAccountType: active.normalizedType,
            detected_prefix: active.detected_prefix,
          });
          setAuthenticatedAccount(active.deriv_token, requestedAccountId, activeIsDemo);
          lastWebSocketAccountKeyRef.current = activeAccountKey;
          console.log("Deriv authenticated WebSocket initialized", {
            account_id: requestedAccountId,
            loginid: active.loginid,
            normalizedType: active.normalizedType,
            detected_prefix: active.detected_prefix,
            is_virtual: activeIsDemo,
          });
        } else {
          console.info("[Deriv Balance] Skipped Deriv WebSocket account initialization", {
            requestedAccountId,
            requestedAccountType: active.normalizedType,
            detected_prefix: active.detected_prefix,
          });
        }
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
          else await updateQuery.eq("account_id", requestedAccountId);
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
  }, [
    activeAccountKey,
    active?.account_id,
    active?.deriv_token,
    active?.id,
    active?.loginid,
    isBrowser,
    user,
  ]);

  const switchAccount = useCallback(
    (accountId: string) => {
      setActiveId((currentId) => {
        if (currentId === accountId) {
          console.info("[Deriv Balance] switchAccount skipped", {
            previousSelectedAccountId: currentId,
            nextSelectedAccountId: accountId,
          });
          return currentId;
        }
        console.info("[Deriv Balance] switchAccount applied", {
          previousSelectedAccountId: currentId,
          nextSelectedAccountId: accountId,
        });
        return accountId;
      });
      if (user) localStorage.setItem(accountStorageKey(user.id), accountId);
      const target = accounts.find((account) => account.account_id === accountId);
      if (target) {
        setBalance(target.balance != null ? Number(target.balance) : null);
        setCurrency(target.currency ?? "");
      }
    },
    [accounts, user],
  );

  return {
    account: active,
    accounts,
    balance,
    currency,
    loading,
    switchAccount,
  };
}
