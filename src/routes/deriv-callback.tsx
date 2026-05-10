import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DERIV_CLIENT_ID_VALUE,
  DERIV_REDIRECT_URI_VALUE,
  setAuthenticatedAccount,
} from "@/lib/deriv";
import { normalizeDerivAccount } from "@/lib/deriv-account";
import { derivCredentials } from "@/lib/deriv-credentials";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";

type DerivTokenResponse = {
  access_token?: string;
  expires_in?: string | number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type DerivAccount = {
  account_id: string;
  loginid?: string;
  currency?: string;
  balance?: string | number;
  is_demo?: boolean | string | number;
  is_virtual?: boolean | string | number;
  account_type?: string;
};

type DerivAccountsResponse = {
  data?: DerivAccount[];
  error?: string;
  detail?: string;
};

export const Route = createFileRoute("/deriv-callback")({
  component: DerivCallback,
});

let callbackInFlight = false;
const CALLBACK_PROCESSING_KEY = "deriv_callback_processing";
const OAUTH_PROCESSING_KEY = "deriv_oauth_processing";
const OAUTH_REDIRECTING_KEY = "deriv_oauth_redirecting";
const DERIV_RAPID_APPROVAL_MESSAGE = "Please wait one minute and try again.";
const SESSION_COLUMNS = [
  "user_id",
  "account_id",
  "loginid",
  "deriv_token",
  "is_demo",
  "is_virtual",
  "currency",
  "balance",
  "is_active",
  "expires_at",
] as const;

function activeAccountStorageKey(userId: string) {
  return `deriv_active_account:${userId}`;
}

function sessionStorageKeys() {
  return Object.keys(sessionStorage).filter((key) => key.startsWith("deriv_"));
}

function logCallbackStage(stage: string, details: Record<string, unknown> = {}) {
  console.info(`[Deriv Callback] ${stage}`, details);
}

function logCallbackFailure(stage: string, details: Record<string, unknown> = {}) {
  console.error(`[Deriv Callback] ${stage}`, details);
}

async function responseJson<T>(response: Response, fallback: T): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

function accountLogSummary(account: ReturnType<typeof normalizeDerivAccount>) {
  if (!account) return null;
  return {
    account_id: account.account_id,
    loginid: account.loginid,
    detected_prefix: account.detected_prefix,
    normalizedType: account.normalizedType,
    final_tab_placement: account.final_tab_placement,
    is_demo: account.is_demo,
    is_virtual: account.is_virtual,
    currency: account.currency,
    balance: account.balance,
    reason: account.classification_reason,
  };
}

async function ensureSupabaseSession(primaryAccountId: string) {
  const { email, password } = await derivCredentials(primaryAccountId);
  logCallbackStage("Supabase auth started", {
    primaryAccountId,
    email,
  });

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (!signInError && signIn.user) {
    logCallbackStage("active session created", {
      method: "sign-in",
      userId: signIn.user.id,
      hasSession: Boolean(signIn.session),
    });
    return signIn.user;
  }
  logCallbackStage("Supabase sign-in did not reuse an existing session", {
    primaryAccountId,
    error: signInError?.message ?? null,
  });

  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: primaryAccountId, deriv_account_id: primaryAccountId },
    },
  });
  if (signUpError) {
    logCallbackFailure("Supabase sign-up failure", {
      primaryAccountId,
      error: signUpError.message,
    });
    throw signUpError;
  }

  if (!signUp.session) {
    logCallbackStage("Supabase sign-up requires sign-in retry", {
      primaryAccountId,
      userId: signUp.user?.id ?? null,
    });
    const { data: retry, error: retryErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (retryErr) {
      logCallbackFailure("Supabase retry sign-in failure", {
        primaryAccountId,
        error: retryErr.message,
      });
      throw retryErr;
    }
    logCallbackStage("active session created", {
      method: "sign-up-retry",
      userId: retry.user?.id ?? null,
      hasSession: Boolean(retry.session),
    });
    return retry.user!;
  }
  logCallbackStage("active session created", {
    method: "sign-up",
    userId: signUp.user?.id ?? null,
    hasSession: Boolean(signUp.session),
  });
  return signUp.user!;
}

function DerivCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Connecting your Deriv account...");
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState("callback-started");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let currentStage = "callback URL received";
    const markStage = (nextStage: string, details: Record<string, unknown> = {}) => {
      currentStage = nextStage;
      setStage(nextStage);
      logCallbackStage(nextStage, details);
    };

    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorDescription = params.get("error_description");
    const code = params.get("code");
    const state = params.get("state");
    markStage("callback URL received", {
      origin: window.location.origin,
      pathname: window.location.pathname,
      searchKeys: Array.from(params.keys()),
      referrer: document.referrer || null,
    });
    markStage("has code", {
      hasCode: Boolean(code),
      codeLength: code?.length ?? 0,
    });
    markStage("has state", {
      hasState: Boolean(state),
      statePrefix: state ? `${state.slice(0, 8)}...` : null,
    });

    if (callbackInFlight) {
      markStage("duplicate callback blocked", {
        reason: "callback already in flight in this browser context",
      });
      setStatus("Deriv authorization is already being processed...");
      return;
    }

    const staleCallbackProcessing = sessionStorage.getItem(CALLBACK_PROCESSING_KEY) === "true";
    const staleOAuthProcessing = sessionStorage.getItem(OAUTH_PROCESSING_KEY) === "true";
    if (staleCallbackProcessing || staleOAuthProcessing) {
      markStage("stale processing guard cleared", {
        deriv_callback_processing: staleCallbackProcessing,
        deriv_oauth_processing: staleOAuthProcessing,
        hasCode: Boolean(code),
        hasState: Boolean(state),
      });
      sessionStorage.removeItem(CALLBACK_PROCESSING_KEY);
      sessionStorage.removeItem(OAUTH_PROCESSING_KEY);
    }

    callbackInFlight = true;
    sessionStorage.setItem(CALLBACK_PROCESSING_KEY, "true");
    sessionStorage.setItem(OAUTH_PROCESSING_KEY, "true");
    sessionStorage.removeItem(OAUTH_REDIRECTING_KEY);
    sessionStorage.removeItem("deriv_callback_failed");

    (async () => {
      try {
        markStage("callback query parsed", {
          hasCode: Boolean(code),
          hasState: Boolean(state),
          error,
          errorDescription,
          redirect_uri: DERIV_REDIRECT_URI_VALUE,
          client_id: DERIV_CLIENT_ID_VALUE,
        });
        if (error) {
          const detail = errorDescription ? `${error}: ${errorDescription}` : error;
          if (error === "access_denied") {
            throw new Error(
              "Authorization cancelled. Please approve ArkTrader Hub access in Deriv.",
            );
          }
          if (errorDescription?.toLowerCase().includes("redirect")) {
            throw new Error(
              `Invalid redirect URI. Deriv must be configured with exactly ${DERIV_REDIRECT_URI_VALUE}.`,
            );
          }
          if (error === "invalid_request") {
            throw new Error(`Authorization failed: ${detail}`);
          }
          throw new Error(`Authorization failed: ${detail}`);
        }

        if (!code) throw new Error("Missing authorization code");
        if (!state) throw new Error("State mismatch");

        const expectedState = sessionStorage.getItem("deriv_oauth_state");
        markStage("state matches stored state", {
          returnedStateExists: Boolean(state),
          storedStateExists: Boolean(expectedState),
          matches: expectedState === state,
          storageKey: "deriv_oauth_state",
        });
        if (!expectedState || expectedState !== state) {
          throw new Error("State mismatch. Please restart the Deriv authorization flow.");
        }

        const codeVerifier = sessionStorage.getItem("deriv_code_verifier");
        markStage("code_verifier exists", {
          exists: Boolean(codeVerifier),
          length: codeVerifier?.length ?? 0,
          storageKey: "deriv_code_verifier",
        });
        if (!codeVerifier) {
          logCallbackFailure("missing code_verifier", {
            sessionStorageKeys: sessionStorageKeys(),
          });
          throw new Error("Expired login session. Please sign in with Deriv again.");
        }

        sessionStorage.removeItem("deriv_oauth_state");
        sessionStorage.removeItem("deriv_code_verifier");

        setStatus("Exchanging Deriv authorization code...");
        markStage("token exchange started", {
          localRoute: "/api/deriv-token-exchange",
          providerEndpoint: "https://auth.deriv.com/oauth2/token",
          method: "POST",
          grant_type: "authorization_code",
          client_id: DERIV_CLIENT_ID_VALUE,
          redirect_uri: DERIV_REDIRECT_URI_VALUE,
          hasCode: Boolean(code),
          hasCodeVerifier: Boolean(codeVerifier),
        });
        const tokenResponse = await fetch("/api/deriv-token-exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, codeVerifier }),
        });
        const tokenData = await responseJson<DerivTokenResponse>(tokenResponse, {
          error: "invalid_response",
          error_description: "Token exchange returned a non-JSON response",
        });
        const tokenLog = {
          ok: tokenResponse.ok,
          status: tokenResponse.status,
          hasAccessToken: Boolean(tokenData.access_token),
          expiresIn: tokenData.expires_in,
          tokenType: tokenData.token_type,
          error: tokenData.error,
          errorDescription: tokenData.error_description,
        };
        if (!tokenResponse.ok) {
          markStage("token exchange failure", tokenLog);
          if (tokenResponse.status === 403) {
            throw new Error(DERIV_RAPID_APPROVAL_MESSAGE);
          }
          throw new Error(
            tokenData?.error_description
              ? `Token exchange failed: ${tokenData.error_description}`
              : tokenData?.error
                ? `Token exchange failed: ${tokenData.error}`
                : "Token exchange failed",
          );
        }
        markStage("token exchange success", tokenLog);

        const accessToken = tokenData.access_token;
        const expiresIn = Number(tokenData.expires_in ?? 0);
        markStage("access_token exists", {
          exists: Boolean(accessToken),
          expiresIn,
          tokenType: tokenData.token_type ?? null,
        });
        if (!accessToken) throw new Error("No access token returned");

        setStatus("Loading Deriv accounts...");
        markStage("accounts fetch started", {
          localRoute: "/api/deriv-accounts",
          browserDirectToDeriv: false,
          hasAccessToken: Boolean(accessToken),
        });
        const accountsResponse = await fetch("/api/deriv-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        const accountsData = await responseJson<DerivAccountsResponse>(accountsResponse, {
          error: "Deriv accounts endpoint returned a non-JSON response",
        });
        const accountsLog = {
          ok: accountsResponse.ok,
          status: accountsResponse.status,
          accountCount: accountsData.data?.length ?? 0,
          error: accountsData.error,
          detail: accountsData.detail,
        };
        if (!accountsResponse.ok) {
          markStage("accounts fetch failure", accountsLog);
          if (accountsResponse.status === 403) {
            throw new Error(DERIV_RAPID_APPROVAL_MESSAGE);
          }
          if (accountsResponse.status === 429) {
            throw new Error(
              accountsData.error ??
                "Deriv is rate limiting account requests. Please wait a moment, then start login again.",
            );
          }
          throw new Error(accountsData.detail ?? accountsData.error ?? "Could not load Deriv accounts");
        }
        markStage("accounts fetch success", accountsLog);
        markStage("accounts count", {
          count: accountsData.data?.length ?? 0,
        });

        console.info("[Deriv Accounts] callback raw accounts before normalization", accountsData?.data ?? []);
        const normalizedAccounts = (accountsData?.data ?? [])
          .map((account) => normalizeDerivAccount(account, { trustVirtualFlags: true }))
          .filter((account): account is NonNullable<ReturnType<typeof normalizeDerivAccount>> =>
            Boolean(account),
          );
        const unknownAccounts = normalizedAccounts.filter(
          (account) => account.normalizedType === "unknown",
        );
        if (unknownAccounts.length) {
          console.warn("[Deriv Accounts] callback unknown accounts excluded", unknownAccounts);
        }
        const accounts = normalizedAccounts.filter((account) => account.normalizedType !== "unknown");
        if (!accounts.length) throw new Error("No Deriv accounts returned");
        markStage("normalized accounts", {
          accounts: accounts.map(accountLogSummary),
        });
        console.info(
          "[Deriv Accounts] callback realAccounts",
          accounts.filter((account) => account.normalizedType === "real"),
        );
        console.info(
          "[Deriv Accounts] callback demoAccounts",
          accounts.filter((account) => account.normalizedType === "demo"),
        );

        const primary =
          accounts.find((account) => account.normalizedType === "real") ?? accounts[0];

        setStatus("Creating your ArkTrader session...");
        const primaryAccountId = String(primary.loginid ?? primary.account_id);
        markStage("active session creation started", {
          primaryAccountId,
          primaryAccountType: primary.normalizedType,
        });
        const sessionUser = await ensureSupabaseSession(primaryAccountId);
        const { data: activeSessionData } = await supabase.auth.getSession();
        const activeSessionUserId = activeSessionData.session?.user?.id ?? null;
        markStage("active session created", {
          sessionUserId: sessionUser.id,
          activeSessionUserId,
          matches: activeSessionUserId === sessionUser.id,
        });
        if (activeSessionUserId !== sessionUser.id) {
          throw new Error("Supabase session was created but is not active. Please sign in again.");
        }
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        markStage("Supabase upsert started", {
          table: "sessions",
          onConflict: "user_id,account_id",
          expectedUniqueConstraint: "sessions_user_id_account_id_key",
          columns: SESSION_COLUMNS,
          accountCount: accounts.length,
        });
        const savedAccounts: string[] = [];
        for (const account of accounts) {
          const accountId = String(account.loginid ?? account.account_id);
          const isVirtual = account.normalizedType === "demo";
          const accountCurrency = account.currency ?? (isVirtual ? "USD" : "");
          setStatus(`Linking ${accountId}...`);
          markStage("Supabase upsert started", {
            account_id: accountId,
            loginid: account.loginid,
            detected_prefix: account.detected_prefix,
            normalizedType: account.normalizedType,
            final_tab_placement: account.final_tab_placement,
            is_demo: isVirtual,
            is_virtual: isVirtual,
          });
          const { data: savedSession, error: upsertErr } = await supabase.from("sessions").upsert(
            {
              user_id: sessionUser.id,
              account_id: accountId,
              loginid: accountId,
              deriv_token: accessToken,
              currency: accountCurrency,
              balance: Number(account.balance ?? 0),
              is_demo: isVirtual,
              is_virtual: isVirtual,
              is_active: true,
              expires_at: expiresAt,
            },
            { onConflict: "user_id,account_id" },
          ).select("id, account_id, loginid, is_demo, is_virtual, currency, balance, is_active, expires_at")
            .maybeSingle();
          if (upsertErr) {
            markStage("Supabase upsert failure", {
              account_id: accountId,
              message: upsertErr.message,
              code: upsertErr.code,
              details: upsertErr.details,
              hint: upsertErr.hint,
              onConflict: "user_id,account_id",
            });
            throw upsertErr;
          }
          savedAccounts.push(accountId);
          markStage("Supabase upsert success", {
            account_id: accountId,
            savedSession,
          });
        }
        markStage("Supabase upsert success", {
          savedAccountIds: savedAccounts,
          savedCount: savedAccounts.length,
        });

        const selectedAccountId = String(primary.loginid ?? primary.account_id);
        localStorage.setItem(activeAccountStorageKey(sessionUser.id), selectedAccountId);
        setAuthenticatedAccount(
          accessToken,
          selectedAccountId,
          primary.normalizedType === "demo",
        );
        markStage("selected account set", {
          selectedAccountId,
          selectedAccountType: primary.normalizedType,
          storageKey: activeAccountStorageKey(sessionUser.id),
        });
        window.dispatchEvent(
          new CustomEvent("deriv:sessions-updated", {
            detail: {
              userId: sessionUser.id,
              selectedAccountId,
              accountCount: savedAccounts.length,
            },
          }),
        );
        markStage("Deriv session context refresh requested", {
          event: "deriv:sessions-updated",
          selectedAccountId,
        });
        toast.success(
          `Welcome - ${accounts.length} Deriv account${accounts.length > 1 ? "s" : ""} linked.`,
        );
        const storedReturnTo = sessionStorage.getItem("deriv_oauth_return_to");
        const returnTo = "/dashboard";
        markStage("redirect to dashboard", {
          returnTo,
          storedReturnTo,
          savedCount: savedAccounts.length,
          selectedAccountId,
        });
        callbackInFlight = false;
        sessionStorage.removeItem(CALLBACK_PROCESSING_KEY);
        sessionStorage.removeItem(OAUTH_PROCESSING_KEY);
        sessionStorage.removeItem(OAUTH_REDIRECTING_KEY);
        sessionStorage.removeItem("deriv_oauth_return_to");
        window.location.replace(returnTo.startsWith("/") ? returnTo : "/dashboard");
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Authorization failed";
        logCallbackFailure("callback failed", {
          stage: currentStage,
          message,
          error: e,
          sessionStorageKeys: sessionStorageKeys(),
        });
        callbackInFlight = false;
        sessionStorage.removeItem(CALLBACK_PROCESSING_KEY);
        sessionStorage.removeItem(OAUTH_PROCESSING_KEY);
        sessionStorage.removeItem(OAUTH_REDIRECTING_KEY);
        sessionStorage.setItem("deriv_callback_failed", message);
        setFailed(true);
        setErrorMessage(message);
        setStatus(message);
        toast.error(message);
      }
    })();
  }, [navigate]);

  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="glass-card w-[min(calc(100vw-2rem),34rem)] rounded-xl p-6">
        <div className="flex items-center gap-3">
          {failed ? (
            <AlertTriangle className="size-5 shrink-0 text-destructive" />
          ) : (
            <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium">{status}</div>
            <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
              {stage}
            </div>
          </div>
        </div>
        {failed && (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <div>{errorMessage ?? "Deriv login could not be completed."}</div>
            <button
              type="button"
              onClick={() => navigate({ to: "/auth", search: { mode: "signin" } })}
              className="mt-3 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
