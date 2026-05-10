import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DERIV_CLIENT_ID_VALUE, DERIV_REDIRECT_URI_VALUE } from "@/lib/deriv";
import { normalizeDerivAccount } from "@/lib/deriv-account";
import { derivCredentials } from "@/lib/deriv-credentials";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
};

export const Route = createFileRoute("/deriv-callback")({
  component: DerivCallback,
});

let callbackInFlight = false;

async function ensureSupabaseSession(primaryAccountId: string) {
  const { email, password } = await derivCredentials(primaryAccountId);

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (!signInError && signIn.user) return signIn.user;

  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: primaryAccountId, deriv_account_id: primaryAccountId },
    },
  });
  if (signUpError) throw signUpError;

  if (!signUp.session) {
    const { data: retry, error: retryErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (retryErr) throw retryErr;
    return retry.user!;
  }
  return signUp.user!;
}

function DerivCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Connecting your Deriv account...");
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (callbackInFlight || sessionStorage.getItem("deriv_callback_processing") === "true") {
      setStatus("Deriv authorization is already being processed...");
      return;
    }
    callbackInFlight = true;
    sessionStorage.setItem("deriv_callback_processing", "true");
    sessionStorage.removeItem("deriv_callback_failed");

    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const error = params.get("error");
        const errorDescription = params.get("error_description");
        const code = params.get("code");
        const state = params.get("state");
        console.log("Deriv OAuth callback query", {
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
        console.log("Deriv OAuth state validation", {
          returnedStateExists: Boolean(state),
          storedStateExists: Boolean(expectedState),
          matches: expectedState === state,
        });
        if (!expectedState || expectedState !== state) {
          throw new Error("State mismatch. Please restart the Deriv authorization flow.");
        }

        const codeVerifier = sessionStorage.getItem("deriv_code_verifier");
        if (!codeVerifier) {
          console.error("Deriv OAuth missing code_verifier", {
            sessionStorageKeys: Object.keys(sessionStorage).filter((key) =>
              key.startsWith("deriv_"),
            ),
          });
          throw new Error("Expired login session. Please sign in with Deriv again.");
        }

        sessionStorage.removeItem("deriv_oauth_state");
        sessionStorage.removeItem("deriv_code_verifier");

        setStatus("Exchanging Deriv authorization code...");
        const tokenResponse = await fetch("/api/deriv-token-exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, codeVerifier }),
        });
        const tokenData = (await tokenResponse.json()) as DerivTokenResponse;
        console.log("Deriv OAuth browser token exchange result", {
          ok: tokenResponse.ok,
          hasAccessToken: Boolean(tokenData.access_token),
          expiresIn: tokenData.expires_in,
          tokenType: tokenData.token_type,
          error: tokenData.error,
          errorDescription: tokenData.error_description,
        });
        if (!tokenResponse.ok) {
          throw new Error(
            tokenData?.error_description
              ? `Token exchange failed: ${tokenData.error_description}`
              : tokenData?.error
                ? `Token exchange failed: ${tokenData.error}`
                : "Token exchange failed",
          );
        }

        const accessToken = tokenData.access_token;
        const expiresIn = Number(tokenData.expires_in ?? 0);
        if (!accessToken) throw new Error("No access token returned");

        setStatus("Loading Deriv accounts...");
        const accountsResponse = await fetch("/api/deriv-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        const accountsData = (await accountsResponse.json()) as DerivAccountsResponse;
        console.log("Deriv accounts response", {
          ok: accountsResponse.ok,
          status: accountsResponse.status,
          accountCount: accountsData.data?.length ?? 0,
          error: accountsData.error,
        });
        if (!accountsResponse.ok) {
          if (accountsResponse.status === 429) {
            throw new Error(
              accountsData.error ??
                "Deriv is rate limiting account requests. Please wait a moment, then start login again.",
            );
          }
          throw new Error(accountsData.error ?? "Could not load Deriv accounts");
        }

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
        console.info("[Deriv Accounts] callback normalized accounts", accounts.map((account) => ({
          account_id: account.account_id,
          loginid: account.loginid,
          detected_prefix: account.detected_prefix,
          normalizedType: account.normalizedType,
          final_tab_placement: account.final_tab_placement,
          is_demo: account.is_demo,
          is_virtual: account.is_virtual,
          reason: account.classification_reason,
        })));
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
        const sessionUser = await ensureSupabaseSession(primaryAccountId);
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        for (const account of accounts) {
          const accountId = String(account.loginid ?? account.account_id);
          const isVirtual = account.normalizedType === "demo";
          const accountCurrency = account.currency ?? (isVirtual ? "USD" : "");
          setStatus(`Linking ${accountId}...`);
          console.info("[Deriv Accounts] Supabase session mapping", {
            account_id: accountId,
            loginid: account.loginid,
            detected_prefix: account.detected_prefix,
            normalizedType: account.normalizedType,
            final_tab_placement: account.final_tab_placement,
            is_demo: isVirtual,
            is_virtual: isVirtual,
          });
          const { error: upsertErr } = await supabase.from("sessions").upsert(
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
          );
          if (upsertErr) throw upsertErr;
        }
        toast.success(
          `Welcome - ${accounts.length} Deriv account${accounts.length > 1 ? "s" : ""} linked.`,
        );
        const returnTo = sessionStorage.getItem("deriv_oauth_return_to") ?? "/dashboard";
        callbackInFlight = false;
        sessionStorage.removeItem("deriv_callback_processing");
        sessionStorage.removeItem("deriv_oauth_return_to");
        window.location.replace(returnTo.startsWith("/") ? returnTo : "/dashboard");
      } catch (e: unknown) {
        console.error(e);
        const message = e instanceof Error ? e.message : "Authorization failed";
        callbackInFlight = false;
        sessionStorage.setItem("deriv_callback_failed", message);
        setFailed(true);
        setStatus(message);
        toast.error(message);
        window.setTimeout(() => {
          navigate({ to: "/auth", search: { mode: "signin" } });
        }, 3500);
      }
    })();
  }, [navigate]);

  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="glass-card flex items-center gap-3 rounded-xl p-6">
        {!failed && <Loader2 className="size-5 animate-spin text-primary" />}
        <span className="text-sm">{status}</span>
      </div>
    </div>
  );
}
