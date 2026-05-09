import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DERIV_CLIENT_ID_VALUE, DERIV_REDIRECT_URI_VALUE } from "@/lib/deriv";
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
  is_virtual?: boolean;
};

type DerivAccountsResponse = {
  data?: DerivAccount[];
  message?: string;
  error?: { message?: string };
};

export const Route = createFileRoute("/deriv-callback")({
  component: DerivCallback,
});

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
        const accountsResponse = await fetch(
          "https://api.derivws.com/trading/v1/options/accounts",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Deriv-App-ID": DERIV_CLIENT_ID_VALUE,
            },
          },
        );
        const accountsData = (await accountsResponse.json()) as DerivAccountsResponse;
        console.log("Deriv accounts response", {
          ok: accountsResponse.ok,
          status: accountsResponse.status,
          accountCount: accountsData.data?.length ?? 0,
          error: accountsData.error?.message ?? accountsData.message,
        });
        if (!accountsResponse.ok) {
          throw new Error(
            accountsData?.message ??
              accountsData?.error?.message ??
              "Could not load Deriv accounts",
          );
        }

        const accounts = accountsData?.data ?? [];
        if (!accounts.length) throw new Error("No Deriv accounts returned");

        const primary =
          accounts.find(
            (account) => !String(account.loginid ?? account.account_id).startsWith("VR"),
          ) ?? accounts[0];

        setStatus("Creating your ArkTrader session...");
        const primaryAccountId = String(primary.loginid ?? primary.account_id);
        const sessionUser = await ensureSupabaseSession(primaryAccountId);
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        for (const account of accounts) {
          const accountId = String(account.loginid ?? account.account_id);
          setStatus(`Linking ${accountId}...`);
          const { error: upsertErr } = await supabase.from("sessions").upsert(
            {
              user_id: sessionUser.id,
              account_id: accountId,
              loginid: accountId,
              deriv_token: accessToken,
              currency: account.currency ?? "",
              balance: Number(account.balance ?? 0),
              is_demo: account.is_virtual ?? accountId.startsWith("VR"),
              is_virtual: account.is_virtual ?? accountId.startsWith("VR"),
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
        sessionStorage.removeItem("deriv_oauth_return_to");
        window.location.replace(returnTo.startsWith("/") ? returnTo : "/dashboard");
      } catch (e: unknown) {
        console.error(e);
        const message = e instanceof Error ? e.message : "Authorization failed";
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
