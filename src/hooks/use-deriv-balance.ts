// src/hooks/use-deriv-balance.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  setAuthenticatedAccount,
  subscribeBalance,
  type DerivTokenSource,
} from "@/lib/deriv";
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
  expires_at?: string | null;
  created_at?: string | null;
  token_source?: DerivTokenSource;
};

export type LiveBalance = {
  account: DerivAccount | null;
  accounts: DerivAccount[];
  balance: number | null;
  currency: string;
  loading: boolean;
  refreshing: boolean;
  refreshBalances: (reason?: string, selectedAccountId?: string) => Promise<void>;
  switchAccount: (accountId: string) => void;
};

function accountStorageKey(userId: string) {
  return `deriv_active_account:${userId}`;
}

function selectedAccountIdStorageKey(userId: string) {
  return `selected_deriv_account_id:${userId}`;
}

function selectedAccountTypeStorageKey(userId: string) {
  return `selected_deriv_account_type:${userId}`;
}

function tokenSourceStorageKey(userId: string, accountId: string) {
  return `deriv_token_source:${userId}:${accountId.toUpperCase()}`;
}

function readSavedSelectedAccount(userId: string) {
  return {
    accountId:
      localStorage.getItem(selectedAccountIdStorageKey(userId)) ??
      localStorage.getItem(accountStorageKey(userId)),
    accountType: localStorage.getItem(selectedAccountTypeStorageKey(userId)),
  };
}

function persistSelectedAccount(userId: string, account: DerivAccount) {
  localStorage.setItem(selectedAccountIdStorageKey(userId), account.account_id);
  localStorage.setItem(selectedAccountTypeStorageKey(userId), account.normalizedType);
  localStorage.setItem(accountStorageKey(userId), account.account_id);
  console.info("[Deriv Balance] saved selected account", {
    userId,
    selected_deriv_account_id: account.account_id,
    selected_deriv_account_type: account.normalizedType,
  });
}

type DerivAccountsApiResponse = {
  data?: Array<Record<string, unknown>>;
  error?: string;
  detail?: string;
};

const DERIV_OAUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function tokenSourceFromText(value: unknown): DerivTokenSource | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;
  if (text.includes("oauth")) return "oauth_access_token";
  if (text.includes("legacy")) return "legacy_authorize_token";
  return null;
}

function fallbackTokenSourceForRaw(
  account: Record<string, unknown>,
): DerivTokenSource | undefined {
  return (
    tokenSourceFromText(account.token_source) ??
    tokenSourceFromText(account.deriv_token_source) ??
    tokenSourceFromText(account.session_source) ??
    tokenSourceFromText(account.auth_type) ??
    undefined
  );
}

function tokenSourceForAccount(
  account: Pick<DerivAccount, "account_id" | "deriv_token" | "token_source">,
) {
  return account.token_source ?? null;
}

function isLikelyLegacyToken(
  account: Pick<DerivAccount, "account_id" | "deriv_token" | "token_source">,
) {
  return Boolean(account.deriv_token && tokenSourceForAccount(account) === "legacy_authorize_token");
}

function isOAuthTokenAccount(
  account: Pick<DerivAccount, "account_id" | "deriv_token" | "token_source">,
) {
  return Boolean(account.deriv_token && tokenSourceForAccount(account) === "oauth_access_token");
}

function readTokenSource(
  userId: string,
  accountId: string,
  token: string | null | undefined,
): DerivTokenSource | undefined {
  try {
    const saved = localStorage.getItem(tokenSourceStorageKey(userId, accountId));
    if (saved === "oauth_access_token" || saved === "legacy_authorize_token") return saved;
  } catch {
    /* ignore localStorage access failures */
  }
  console.warn("[Deriv Balance] token_source missing from persisted account metadata", {
    userId,
    accountId,
    tokenExists: Boolean(token),
    reason:
      "Trading adapter selection no longer infers token source from token text. Reconnect if this account cannot trade.",
  });
  return undefined;
}

function timestampValue(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function compareAccountFreshness(left: DerivAccount, right: DerivAccount) {
  const leftExpiry = timestampValue(left.expires_at);
  const rightExpiry = timestampValue(right.expires_at);
  if (leftExpiry !== rightExpiry) return rightExpiry - leftExpiry;
  return timestampValue(right.created_at) - timestampValue(left.created_at);
}

function effectiveAccountExpiresAt(
  account: Pick<DerivAccount, "deriv_token" | "expires_at" | "created_at" | "token_source">,
) {
  const storedExpiryMs = timestampValue(account.expires_at);
  if (tokenSourceForAccount(account) !== "oauth_access_token") {
    return storedExpiryMs ? new Date(storedExpiryMs).toISOString() : account.expires_at;
  }
  const createdAtMs = timestampValue(account.created_at);
  const currentTimeMs = Date.now();
  const platformExpiryMs = createdAtMs ? createdAtMs + DERIV_OAUTH_SESSION_TTL_MS : 0;
  const shortProviderExpiryMs =
    storedExpiryMs &&
    storedExpiryMs >= currentTimeMs - DERIV_OAUTH_SESSION_TTL_MS &&
    storedExpiryMs <= currentTimeMs + 24 * 60 * 60 * 1000
      ? storedExpiryMs + DERIV_OAUTH_SESSION_TTL_MS
      : 0;
  const effectiveExpiryMs = Math.max(storedExpiryMs, platformExpiryMs, shortProviderExpiryMs);
  return effectiveExpiryMs ? new Date(effectiveExpiryMs).toISOString() : account.expires_at;
}

function accountSessionExpired(
  account: Pick<DerivAccount, "deriv_token" | "expires_at" | "created_at" | "token_source">,
) {
  if (!account.deriv_token) return true;
  const effectiveExpiresAt = effectiveAccountExpiresAt(account);
  if (!effectiveExpiresAt) return false;
  const expiry = new Date(effectiveExpiresAt).getTime();
  if (!Number.isFinite(expiry)) return false;
  return expiry <= Date.now() - 60_000;
}

function dedupeAccountsByLogin(accounts: DerivAccount[]) {
  const sorted = [...accounts].sort(compareAccountFreshness);
  const byAccountId = new Map<string, DerivAccount>();
  for (const account of sorted) {
    const key = account.account_id.toUpperCase();
    if (!byAccountId.has(key)) byAccountId.set(key, account);
  }
  return Array.from(byAccountId.values());
}

function accountSummary(account: Pick<DerivAccount, "account_id" | "loginid" | "currency" | "balance" | "normalizedType" | "detected_prefix" | "token_source">) {
  return {
    account_id: account.account_id,
    loginid: account.loginid,
    currency: account.currency,
    balance: account.balance,
    normalizedType: account.normalizedType,
    detected_prefix: account.detected_prefix,
    token_source: account.token_source,
  };
}

function normalizeFreshAccount(
  account: Record<string, unknown>,
  fallbackToken?: string | null,
  fallbackTokenSource?: DerivTokenSource,
) {
  const normalized = normalizeDerivAccount(
    {
      ...account,
      deriv_token: account.deriv_token ?? fallbackToken,
    },
    { trustVirtualFlags: false },
  );
  if (!normalized?.deriv_token) return null;
  return {
    ...normalized,
    token_source: fallbackTokenSource ?? fallbackTokenSourceForRaw(account),
  } as DerivAccount;
}

export function useDerivBalance(): LiveBalance {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const lastWebSocketAccountKeyRef = useRef<string | null>(null);
  const legacyAutoRefreshKeysRef = useRef<Set<string>>(new Set());
  const loadedUserIdRef = useRef<string | null>(null);
  const accountsRef = useRef<DerivAccount[]>([]);
  const sessionRefreshReasonRef = useRef<string | null>(null);

  const isBrowser = typeof window !== "undefined";

  useEffect(() => {
    if (!isBrowser) return;
    const refreshSessions = (event: Event) => {
      console.info("[Deriv Balance] session context refresh requested", {
        detail: event instanceof CustomEvent ? event.detail : null,
      });
      sessionRefreshReasonRef.current =
        event instanceof CustomEvent && typeof event.detail?.reason === "string"
          ? event.detail.reason
          : null;
      setLoading(true);
      setReloadNonce((value) => value + 1);
    };
    window.addEventListener("deriv:sessions-updated", refreshSessions);
    return () => window.removeEventListener("deriv:sessions-updated", refreshSessions);
  }, [isBrowser]);

  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  // Load all sessions for this user.
  useEffect(() => {
    if (!user || !isBrowser) {
      setAccounts([]);
      setActiveId(null);
      setBalance(null);
      setCurrency("");
      setLoading(false);
      loadedUserIdRef.current = null;
      return;
    }
    let cancelled = false;
    const userChanged = loadedUserIdRef.current !== user.id;
    setLoading(true);
    if (userChanged) {
      setAccounts([]);
      setActiveId(null);
      setBalance(null);
      setCurrency("");
      lastWebSocketAccountKeyRef.current = null;
      legacyAutoRefreshKeysRef.current.clear();
      loadedUserIdRef.current = user.id;
    }
    console.info("[Deriv Accounts] loading sessions for active Supabase user", {
      userId: user.id,
      reloadNonce,
      userChanged,
    });
    (async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, account_id, loginid, deriv_token, is_demo, is_virtual, currency, balance, expires_at, created_at")
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
      const normalized = dedupeAccountsByLogin(rawAccounts
        .map((account) => {
          const normalized = normalizeDerivAccount(account, { trustVirtualFlags: false });
          if (!normalized?.deriv_token) return null;
          return {
            ...normalized,
            token_source: readTokenSource(
              user.id,
              normalized.account_id,
              normalized.deriv_token,
            ),
          } as DerivAccount;
        })
        .filter((account): account is DerivAccount => Boolean(account)));
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
        token_source: account.token_source,
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
        const savedSelection = readSavedSelectedAccount(user.id);
        const savedAccount = list.find(
          (account) =>
            account.account_id === savedSelection.accountId &&
            (!savedSelection.accountType ||
              account.normalizedType === savedSelection.accountType),
        );
        const savedAccountExpired = savedAccount ? accountSessionExpired(savedAccount) : false;
        const savedTypeFallback =
          savedSelection.accountType === "demo"
            ? demoAccounts.find((account) => !accountSessionExpired(account))
            : savedSelection.accountType === "real"
              ? realAccounts.find((account) => !accountSessionExpired(account))
              : null;
        const selected =
          savedAccount && !savedAccountExpired
            ? savedAccount
            : savedTypeFallback ??
              realAccounts.find((account) => !accountSessionExpired(account)) ??
              demoAccounts.find((account) => !accountSessionExpired(account)) ??
              list[0];
        if (savedAccount && !savedAccountExpired) {
          console.info("[Deriv Balance] restored selected account", {
            userId: user.id,
            savedSelectedAccountId: savedSelection.accountId,
            savedSelectedAccountType: savedSelection.accountType,
            restoredAccount: accountSummary(savedAccount),
          });
        } else {
          console.info("[Deriv Balance] selected account fallback", {
            userId: user.id,
            savedSelectedAccountId: savedSelection.accountId,
            savedSelectedAccountType: savedSelection.accountType,
            fallbackReason: !savedSelection.accountId
              ? "no-saved-account"
              : !savedAccount
                ? "saved-account-not-found-or-type-mismatch"
                : savedAccountExpired
                  ? "saved-account-expired"
                  : "unknown",
            fallbackAccount: accountSummary(selected),
          });
        }
        setActiveId(selected.account_id);
        setBalance(selected.balance != null ? Number(selected.balance) : null);
        setCurrency(selected.currency ?? "");
        persistSelectedAccount(user.id, selected);
      } else {
        const previousAccounts = accountsRef.current;
        const reason = sessionRefreshReasonRef.current;
        const shouldClearForExplicitSessionEnd =
          reason === "deriv-invalid-token" ||
          reason === "legacy-authorize-invalid-token" ||
          reason === "deriv-session-expired";
        if (previousAccounts.length && !shouldClearForExplicitSessionEnd) {
          console.warn("[Deriv Accounts] empty session refresh preserved existing accounts", {
            userId: user.id,
            reloadNonce,
            reason,
            preservedAccountIds: previousAccounts.map((account) => account.account_id),
          });
          setLoading(false);
          return;
        }
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
    ? `${active.deriv_token}:${active.account_id}:${active.normalizedType}:${tokenSourceForAccount(active)}`
    : null;

  const refreshBalances = useCallback(
    async (reason = "manual", selectedAccountId = activeId ?? undefined) => {
      if (!isBrowser || !user || !accounts.length) return;
      setRefreshing(true);
      console.info("[Deriv Balance] balance fetch started", {
        reason,
        userId: user.id,
        selectedAccountId,
        accountCount: accounts.length,
        accounts: accounts.map(accountSummary),
      });

      const freshAccountsById = new Map<string, DerivAccount>();
      const mergeFreshAccounts = (
        items: Record<string, unknown>[],
        fallbackToken?: string | null,
        sourceOverride?: DerivTokenSource,
      ) => {
        const normalized = items
          .map((item) => normalizeFreshAccount(item, fallbackToken, sourceOverride))
          .filter((item): item is DerivAccount => Boolean(item));
        for (const account of normalized) {
          const existing = accounts.find((item) => item.account_id === account.account_id);
          freshAccountsById.set(account.account_id, {
            ...existing,
            ...account,
            id: existing?.id ?? account.id,
            deriv_token: account.deriv_token ?? existing?.deriv_token ?? "",
            token_source: account.token_source ?? existing?.token_source,
          });
        }
        return normalized;
      };

      try {
        const oauthSeed = accounts.find(isOAuthTokenAccount);
        if (oauthSeed) {
          const response = await fetch("/api/deriv-accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: oauthSeed.deriv_token, appIdMode: "oauth" }),
          });
          const data = (await response.json().catch(() => ({
            error: "Deriv accounts endpoint returned a non-JSON response",
          }))) as DerivAccountsApiResponse;
          if (!response.ok) {
            throw new Error(data.detail ?? data.error ?? "Could not refresh OAuth Deriv balances");
          }
          const refreshed = mergeFreshAccounts(
            data.data ?? [],
            oauthSeed.deriv_token,
            tokenSourceForAccount(oauthSeed) ?? undefined,
          );
          console.info("[Deriv Balance] balance fetch completed", {
            source: "oauth",
            status: response.status,
            accountCount: refreshed.length,
            accounts: refreshed.map(accountSummary),
          });
        }

        const legacyAccounts = accounts.filter(isLikelyLegacyToken);
        if (legacyAccounts.length) {
          const response = await fetch("/api/deriv-accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appIdMode: "legacy",
              legacyAccounts: legacyAccounts.map((account) => ({
                account_id: account.account_id,
                loginid: account.loginid ?? account.account_id,
                deriv_token: account.deriv_token,
                currency: account.currency,
                balance: account.balance,
                is_demo: account.is_demo,
                is_virtual: account.is_virtual,
                account_type: account.account_type,
              })),
            }),
          });
          const data = (await response.json().catch(() => ({
            error: "Deriv legacy accounts endpoint returned a non-JSON response",
          }))) as DerivAccountsApiResponse;
          if (!response.ok) {
            throw new Error(data.detail ?? data.error ?? "Could not refresh legacy Deriv balances");
          }
          const refreshed = mergeFreshAccounts(
            data.data ?? [],
            undefined,
            "legacy_authorize_token",
          );
          const freshLegacyIds = new Set(refreshed.map((account) => account.account_id));
          const staleLegacyIds = legacyAccounts
            .map((account) => account.account_id)
            .filter((accountId) => !freshLegacyIds.has(accountId));

          if (staleLegacyIds.length) {
            console.warn("[Deriv Balance] preserving legacy Supabase rows missing from refresh", {
              staleLegacyIds,
              freshLegacyIds: Array.from(freshLegacyIds),
              reason:
                "Balance refresh snapshots can be partial; Deriv sessions are only deactivated on manual logout or explicit token expiry/invalid-token responses.",
            });
          }

          console.info("[Deriv Balance] balance fetch completed", {
            source: "legacy",
            status: response.status,
            accountCount: refreshed.length,
            accounts: refreshed.map(accountSummary),
            staleLegacyIds,
          });
        }

        if (!freshAccountsById.size) return;

        for (const account of freshAccountsById.values()) {
          const { error } = await supabase
            .from("sessions")
            .update({
              balance: Number(account.balance ?? 0),
              currency: account.currency ?? "",
              deriv_token: account.deriv_token,
              is_demo: account.normalizedType === "demo",
              is_virtual: account.normalizedType === "demo",
              loginid: account.loginid ?? account.account_id,
            })
            .eq("user_id", user.id)
            .eq("account_id", account.account_id);
          if (error) {
            console.warn("[Deriv Balance] Supabase balance refresh update failed", {
              account_id: account.account_id,
              message: error.message,
              code: error.code,
              details: error.details,
            });
          }
        }

        setAccounts((previous) => {
          const previousLegacyIds = new Set(
            previous
              .filter(isLikelyLegacyToken)
              .map((account) => account.account_id),
          );
          const next = previous.map(
            (account) => freshAccountsById.get(account.account_id) ?? account,
          );

          for (const account of freshAccountsById.values()) {
            if (!next.some((item) => item.account_id === account.account_id)) next.push(account);
          }

          console.info("[Deriv Balance] React account state refreshed", {
            reason,
            previousLegacyIds: Array.from(previousLegacyIds),
            freshAccountIds: Array.from(freshAccountsById.keys()),
            nextAccounts: next.map(accountSummary),
          });
          return next;
        });

        const selectedFresh =
          (selectedAccountId ? freshAccountsById.get(selectedAccountId) : null) ??
          freshAccountsById.get(activeId ?? "");
        if (selectedFresh) {
          setBalance(Number(selectedFresh.balance ?? 0));
          setCurrency(selectedFresh.currency ?? "");
        }

        console.info("[Deriv Balance] balance fetch completed", {
          reason,
          selectedAccountId,
          refreshedAccountIds: Array.from(freshAccountsById.keys()),
        });
      } catch (error) {
        console.warn("[Deriv Balance] balance fetch failed", {
          reason,
          selectedAccountId,
          error,
        });
        throw error;
      } finally {
        setRefreshing(false);
      }
    },
    [accounts, activeId, isBrowser, user],
  );

  // Subscribe to live balance for the active account.
  useEffect(() => {
    if (!isBrowser || !active || !user || !activeAccountKey) return;
    const activeTokenSource = tokenSourceForAccount(active);
    if (!activeTokenSource) {
      console.warn("[Deriv Balance] Skipping live balance WebSocket because token_source is missing", {
        account_id: active.account_id,
        loginid: active.loginid,
        normalizedType: active.normalizedType,
        reason:
          "Trading adapter selection requires persisted token_source. Reconnect this Deriv account if trading is unavailable.",
      });
      return;
    }
    if (isOAuthTokenAccount(active)) {
      console.info("[Deriv Balance] Skipping OAuth live balance WebSocket subscription", {
        account_id: active.account_id,
        loginid: active.loginid,
        normalizedType: active.normalizedType,
        token_source: activeTokenSource,
        reason:
          "OAuth accounts refresh balances through /api/deriv-accounts; live balance WS requires OTP and must not run immediately after login.",
      });
      return;
    }
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
            token_source: activeTokenSource,
          });
          setAuthenticatedAccount(
            active.deriv_token,
            requestedAccountId,
            activeIsDemo,
            activeTokenSource,
          );
          lastWebSocketAccountKeyRef.current = activeAccountKey;
          console.log("Deriv authenticated WebSocket initialized", {
            account_id: requestedAccountId,
            loginid: active.loginid,
            normalizedType: active.normalizedType,
            detected_prefix: active.detected_prefix,
            is_virtual: activeIsDemo,
            token_source: activeTokenSource,
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
          if (b.loginid && b.loginid !== requestedAccountId) {
            console.warn("[Deriv Balance] ignored balance for a different Deriv account", {
              requestedAccountId,
              receivedLoginid: b.loginid,
              receivedCurrency: b.currency,
              receivedBalance: b.balance,
            });
            return;
          }
          console.info("[Deriv Balance] live balance received", {
            requestedAccountId,
            loginid: b.loginid,
            currency: b.currency,
            balance: b.balance,
          });
          setBalance(b.balance);
          if (b.currency) setCurrency(b.currency);
          setAccounts((previous) =>
            previous.map((account) =>
              account.account_id === requestedAccountId
                ? {
                    ...account,
                    balance: b.balance,
                    currency: b.currency || account.currency,
                  }
                : account,
            ),
          );

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

  useEffect(() => {
    if (!isBrowser || !user || loading || !accounts.length) return;
    const refreshableAccounts = accounts.filter((account) => Boolean(account.deriv_token));
    if (!refreshableAccounts.length) return;
    const refreshKey = `${user.id}:${refreshableAccounts
      .map((account) => `${account.account_id}:${account.deriv_token.slice(-6)}`)
      .sort()
      .join("|")}`;
    if (legacyAutoRefreshKeysRef.current.has(refreshKey)) return;
    legacyAutoRefreshKeysRef.current.add(refreshKey);
    void refreshBalances("initial-account-load").catch((error) => {
      console.warn("[Deriv Balance] initial account balance refresh failed", error);
    });
  }, [accounts, isBrowser, loading, refreshBalances, user]);

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
      const target = accounts.find((account) => account.account_id === accountId);
      if (target) {
        if (user) persistSelectedAccount(user.id, target);
        setBalance(target.balance != null ? Number(target.balance) : null);
        setCurrency(target.currency ?? "");
        void refreshBalances("account-switch", accountId).catch((error) => {
          console.warn("[Deriv Balance] account switch balance refresh failed", {
            accountId,
            error,
          });
        });
      }
    },
    [accounts, refreshBalances, user],
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
