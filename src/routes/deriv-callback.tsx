import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DERIV_APP_ID_VALUE } from "@/lib/deriv";
import { derivCredentials } from "@/lib/deriv-credentials";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const error = params.get("error");
        if (error) throw new Error(params.get("error_description") ?? error);

        const code = params.get("code");
        const state = params.get("state");
        if (!code) throw new Error("No authorization code returned");

        const expectedState = sessionStorage.getItem("deriv_oauth_state");
        if (!expectedState || expectedState !== state) throw new Error("State mismatch");

        const codeVerifier = sessionStorage.getItem("deriv_code_verifier");
        if (!codeVerifier) throw new Error("Missing PKCE code verifier");

        sessionStorage.removeItem("deriv_oauth_state");
        sessionStorage.removeItem("deriv_code_verifier");

        setStatus("Exchanging Deriv authorization code...");
        const tokenResponse = await fetch("/api/deriv-token-exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, codeVerifier }),
        });
        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
          throw new Error(tokenData?.error_description ?? tokenData?.error ?? "Deriv token exchange failed");
        }

        const accessToken = tokenData.access_token;
        const expiresIn = Number(tokenData.expires_in ?? 0);
        if (!accessToken) throw new Error("No access token returned");

        setStatus("Loading Deriv accounts...");
        const accountsResponse = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Deriv-App-ID": DERIV_APP_ID_VALUE,
          },
        });
        const accountsData = await accountsResponse.json();
        if (!accountsResponse.ok) {
          throw new Error(accountsData?.message ?? accountsData?.error?.message ?? "Could not load Deriv accounts");
        }

        const accounts = accountsData?.data ?? [];
        if (!accounts.length) throw new Error("No Deriv accounts returned");

        const primary = accounts.find((account: any) => !String(account.account_id).startsWith("VR")) ?? accounts[0];

        setStatus("Creating your ArkTrader session...");
        const sessionUser = await ensureSupabaseSession(primary.account_id);
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        for (const account of accounts) {
          const accountId = String(account.account_id);
          setStatus(`Linking ${accountId}...`);
          const { error: upsertErr } = await supabase.from("sessions").upsert(
            {
              user_id: sessionUser.id,
              account_id: accountId,
              deriv_token: accessToken,
              currency: account.currency ?? "",
              balance: Number(account.balance ?? 0),
              is_demo: accountId.startsWith("VR"),
              is_active: true,
              expires_at: expiresAt,
            },
            { onConflict: "user_id,account_id" },
          );
          if (upsertErr) throw upsertErr;
        }
        toast.success(`Welcome - ${accounts.length} Deriv account${accounts.length > 1 ? "s" : ""} linked.`);
        navigate({ to: "/" });
      } catch (e: any) {
        console.error(e);
        toast.error(e.message ?? "Connection failed");
        navigate({ to: "/auth", search: { mode: "signin" } });
      }
    })();
  }, [navigate]);

  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="glass-card flex items-center gap-3 rounded-xl p-6">
        <Loader2 className="size-5 animate-spin text-primary" />
        <span className="text-sm">{status}</span>
      </div>
    </div>
  );
}
